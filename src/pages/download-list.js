import { mapState, mapGetters } from 'vuex'
import * as Mdf from 'src/model-common'
import ModelBar from 'components/ModelBar.vue'
import RunBar from 'components/RunBar.vue'
import WorksetBar from 'components/WorksetBar.vue'
import ModelInfoDialog from 'components/ModelInfoDialog.vue'
import RunInfoDialog from 'components/RunInfoDialog.vue'
import WorksetInfoDialog from 'components/WorksetInfoDialog.vue'

/* eslint-disable no-multi-spaces */
const LOG_REFRESH_TIME = 1000               // msec, log files refresh interval
const MAX_LOG_SEND_COUNT = 4                // max request to send without response
const MAX_LOG_NO_DATA_COUNT = 15            // pause log refresh if no new data or empty response exceed this count (15 = 15 seconds)
const MAX_LOG_WAIT_PROGRESS_COUNT = 20 * 60 // "recent" progress threshold (20 * 60 = 20 minutes)
/* eslint-enable no-multi-spaces */

export default {
  name: 'DownloadList',
  components: { ModelBar, RunBar, WorksetBar, ModelInfoDialog, RunInfoDialog, WorksetInfoDialog },

  props: {
    digest: { type: String, default: '' },
    refreshTickle: { type: Boolean, default: false }
  },

  data () {
    return {
      downloadLogLst: [],
      folderSelected: '',
      downloadFileLst: [],
      totalLogCount: 0,
      readyLogCount: 0,
      progressLogCount: 0,
      errorLogCount: 0,
      loadWait: false,
      isLogRefreshPaused: false,
      lastLogDt: 0,
      logRefreshInt: '',
      logRefreshCount: 0,
      logSendCount: 0,
      logNoDataCount: 0,
      logAllKey: '',
      modelInfoTickle: false,
      modelInfoDigest: '',
      runInfoTickle: false,
      runInfoDigest: '',
      worksetInfoTickle: false,
      worksetInfoName: ''
    }
  },

  computed: {
    lastLogTimeStamp () {
      return this.lastLogDt ? Mdf.dtToTimeStamp(new Date(this.lastLogDt)) : ''
    },

    ...mapGetters('model', {
      runTextByDigest: 'runTextByDigest'
    }),
    ...mapState('serverState', {
      omsUrl: state => state.omsUrl,
      serverConfig: state => state.config
    })
  },

  watch: {
    refreshTickle () { this.initView() },
    digest () { this.initView() }
  },

  methods: {
    isReady (status) { return status === 'ready' },
    isProgress (status) { return status === 'progress' },
    isError (status) { return status === 'error' },
    isModelKind (kind) { return kind === 'model' },
    isRunKind (kind) { return kind === 'run' },
    isWorksetKind (kind) { return kind === 'workset' },
    isUnkownKind (kind) { return kind !== 'model' && kind !== 'run' && kind !== 'workset' },
    fileTimeStamp (t) {
      if (!t || t <= 0) return ''

      const dt = new Date()
      dt.setTime(t)
      return Mdf.dtToTimeStamp(dt)
    },
    fileSizeStr (size) {
      const fs = Mdf.fileSizeParts(size)
      return fs.val + ' ' + this.$t(fs.name)
    },

    // show model notes dialog
    doShowModelNote (modelDgst) {
      this.modelInfoDigest = modelDgst
      this.modelInfoTickle = !this.modelInfoTickle
    },
    // show run notes dialog
    doShowRunNote (modelDgst, runDgst) {
      this.modelInfoDigest = modelDgst
      this.runInfoDigest = runDgst
      this.runInfoTickle = !this.runInfoTickle
    },
    // show current workset notes dialog
    doShowWorksetNote (modelDgst, name) {
      this.modelInfoDigest = modelDgst
      this.worksetInfoName = name
      this.worksetInfoTickle = !this.worksetInfoTickle
    },
    // show or hide folder tree
    onFolderTreeClick (folder) {
      if (!folder) return

      if (folder === this.folderSelected) { // collapse: this folder is now open
        this.folderSelected = ''
      } else {
        this.folderSelected = folder
        if (this.isLogRefreshPaused) {
          this.doFolderFilesRefresh(this.folderSelected)
        }
      }
    },

    // update page view
    initView () {
      if (!this.serverConfig.AllowDownload) {
        this.$q.notify({ type: 'negative', message: this.$t('Downloads are not allowed') })
        return
      }

      this.downloadLogLst = []
      this.folderSelected = ''
      this.downloadFileLst = []
      this.stopLogRefresh()
      this.startLogRefresh()
    },

    // pause on/off log files refresh
    logRefreshPauseToggle () {
      this.logRefreshCount = 0
      this.logSendCount = 0
      this.logNoDataCount = 0
      this.isLogRefreshPaused = !this.isLogRefreshPaused
    },
    startLogRefresh () {
      this.isLogRefreshPaused = false
      this.logRefreshCount = 0
      this.logSendCount = 0
      this.logNoDataCount = 0
      this.lastLogDt = Date.now() - (LOG_REFRESH_TIME + 2)
      this.logRefreshInt = setInterval(this.onLogRefresh, LOG_REFRESH_TIME)
    },
    stopLogRefresh () {
      this.logRefreshCount = 0
      clearInterval(this.logRefreshInt)
    },

    // refersh log files list
    onLogRefresh () {
      if (this.isLogRefreshPaused) return
      //
      if (this.logSendCount++ < MAX_LOG_SEND_COUNT) {
        this.doLogListRefresh()

        // refresh files list in selected folder
        if ((this.folderSelected || '') !== '') {
          this.doFolderFilesRefresh(this.folderSelected)
        }
      }
      this.logRefreshCount++
    },

    // retrive list of download log files by model digest
    async doLogListRefresh () {
      this.logSendCount = 0
      const now = Date.now()
      if (now - this.lastLogDt < LOG_REFRESH_TIME) return // protect from timeouts storm
      this.lastLogDt = now

      this.loadWait = true
      let isOk = false
      let dLst = []
      const u = this.omsUrl +
        ((this.digest && this.digest !== Mdf.allModelsDownloadLog)
          ? '/api/download/log/model/' + this.digest
          : '/api/download/log/all')
      try {
        const response = await this.$axios.get(u)
        dLst = response.data
        isOk = true
      } catch (e) {
        let em = ''
        try {
          if (e.response) em = e.response.data || ''
        } finally {}
        console.warn('Server offline or download log files retrive failed.', em)
      }
      this.loadWait = false

      if (!isOk || !dLst || !Array.isArray(dLst) || dLst.length <= 0 || !Mdf.isDownloadLogList(dLst)) {
        if (this.logNoDataCount++ > MAX_LOG_NO_DATA_COUNT) this.isLogRefreshPaused = true // pause refresh if no log files exist
        return
      }

      // check if any changes in log files and update status counts
      let logKey = ''
      let nReady = 0
      let nProgress = 0
      let nError = 0
      let maxTime = 0

      for (let k = 0; k < dLst.length; k++) {
        logKey = logKey + '|' + dLst[k].LogFileName + ':' + dLst[k].LogNsTime.toString()

        switch (dLst[k].Status) {
          case 'ready':
            nReady++
            break
          case 'progress':
            nProgress++
            if (dLst[k].LogNsTime > maxTime) maxTime = dLst[k].LogNsTime
            break
          case 'error':
            nError++
            break
        }
      }

      // wait longer if there is a "recent" progress
      const isRecent = nProgress > 0 && (Date.now() - (maxTime / 1000000) < 1000 * MAX_LOG_WAIT_PROGRESS_COUNT)

      if (this.logAllKey === logKey) {
        if (this.logNoDataCount++ > MAX_LOG_NO_DATA_COUNT * (isRecent ? 10 : 1)) this.isLogRefreshPaused = true // pause refresh if no changes in log files
      } else {
        this.logNoDataCount = 0 // new data found
      }

      // copy log file show / hide status
      for (let k = 0; k < dLst.length; k++) {
        dLst[k].isShowLog = false
        const n = this.downloadLogLst.findIndex((dl) => dl.LogFileName === dLst[k].LogFileName)
        if (n >= 0) {
          dLst[k].isShowLog = this.downloadLogLst[n].isShowLog
        }
      }

      // replace download log list
      this.downloadLogLst = dLst

      this.logAllKey = logKey
      this.readyLogCount = nReady
      this.progressLogCount = nProgress
      this.errorLogCount = nError
      this.totalLogCount = this.downloadLogLst.length
    },

    // retrive list of files in download folder
    async doFolderFilesRefresh (folder) {
      if (!folder) {
        return // exit on empty folder
      }
      this.loadWait = true
      let isOk = false
      let fLst = []

      const u = this.omsUrl + '/api/download/file-tree/' + (folder || '')
      try {
        const response = await this.$axios.get(u)
        fLst = response.data
        isOk = true
      } catch (e) {
        let em = ''
        try {
          if (e.response) em = e.response.data || ''
        } finally {}
        console.warn('Server offline or download file tree retrive failed.', em)
      }
      this.loadWait = false

      if (!isOk || !fLst || !Array.isArray(fLst) || fLst.length <= 0 || !Mdf.isDownloadFileTree(fLst)) {
        return
      }

      // store files only, skip folders
      this.downloadFileLst = []
      for (const fi of fLst) {
        if (!fi.IsDir) this.downloadFileLst.push(fi)
      }
    }
  },

  mounted () {
    this.initView()
    this.$emit('tab-mounted', 'download-list', { digest: this.digest })
  },
  beforeDestroy () {
    this.stopLogRefresh()
  }
}