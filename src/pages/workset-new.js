import { mapState, mapGetters } from 'vuex'
import * as Mdf from 'src/model-common'
import WorksetParameterList from 'components/WorksetParameterList.vue'
import RunParameterList from 'components/RunParameterList.vue'
import RunBar from 'components/RunBar.vue'
import WorksetBar from 'components/WorksetBar.vue'
import RunInfoDialog from 'components/RunInfoDialog.vue'
import WorksetInfoDialog from 'components/WorksetInfoDialog.vue'
import ParameterInfoDialog from 'components/ParameterInfoDialog.vue'
import GroupInfoDialog from 'components/GroupInfoDialog.vue'
import CreateWorkset from 'components/CreateWorkset.vue'
import MarkdownEditor from 'components/MarkdownEditor.vue'

export default {
  name: 'WorksetNew',
  components: {
    WorksetParameterList,
    RunParameterList,
    RunBar,
    WorksetBar,
    RunInfoDialog,
    WorksetInfoDialog,
    ParameterInfoDialog,
    GroupInfoDialog,
    CreateWorkset,
    MarkdownEditor
  },

  props: {
    digest: { type: String, default: '' },
    refreshTickle: { type: Boolean, default: false }
  },

  data () {
    return {
      loadWait: false,
      worksetSelected: Mdf.emptyWorksetText(), // currently selected workset
      isParamTreeShow: false,
      worksetInfoTickle: false,
      worksetInfoName: '',
      groupInfoTickle: false,
      groupInfoName: '',
      paramInfoTickle: false,
      paramInfoName: '',
      runCurrent: Mdf.emptyRunText(), // currently selected run
      paramRunInfoTickle: false,
      createWorksetNow: false,
      loadWorksetCreate: false,
      nameOfNewWorkset: '',
      paramWsCopyLst: [],
      paramRunCopyLst: [],
      useBaseRun: false,
      runInfoTickle: false,
      txtNewWorkset: [], // workset description and notes
      newDescrNotes: [] // new workset description and notes
    }
  },

  computed: {
    isNotEmptyWorksetSelected () { return Mdf.isNotEmptyWorksetText(this.worksetSelected) },
    isNotEmptyLanguageList () { return Mdf.isLangList(this.langList) },

    // if true then selected workset in edit mode else read-only and model run enabled
    isReadonlyWorksetSelected () {
      return Mdf.isNotEmptyWorksetText(this.worksetSelected) && this.worksetSelected.IsReadonly
    },
    // retrun true if current run is completed: success, error or exit
    // if run not successfully completed then it we don't know is it possible to use as base run
    isCompletedRunCurrent () {
      return this.runDigestSelected ? Mdf.isRunSuccess(this.runCurrent) : false
    },
    // return true if name of new workset is empty after cleanup
    isEmptyNameOfNewWorkset () { return (Mdf.cleanFileNameInput(this.nameOfNewWorkset) || '') === '' },

    currentWsCopyChangeKey () { return this.worksetNameSelected + '-' + this.paramWsCopyLst.length.toString() },
    currentRunCopyChangeKey () { return this.runDigestSelected + '-' + this.paramRunCopyLst.length.toString() },

    ...mapState('model', {
      theModel: state => state.theModel,
      worksetTextList: state => state.worksetTextList,
      worksetTextListUpdated: state => state.worksetTextListUpdated,
      langList: state => state.langList
    }),
    ...mapGetters('model', {
      runTextByDigest: 'runTextByDigest',
      worksetTextByName: 'worksetTextByName',
      modelLanguage: 'modelLanguage'
    }),
    ...mapState('uiState', {
      runDigestSelected: state => state.runDigestSelected,
      worksetNameSelected: state => state.worksetNameSelected
    }),
    ...mapState('serverState', {
      omsUrl: state => state.omsUrl,
      serverConfig: state => state.config
    })
  },

  watch: {
    digest () { this.doRefresh() },
    refreshTickle () { this.doRefresh() },
    worksetTextListUpdated () { this.doRefresh() },
    worksetNameSelected () {
      this.worksetSelected = this.worksetTextByName({ ModelDigest: this.digest, Name: this.worksetNameSelected })
      this.paramWsCopyLst = []
    }
  },

  methods: {
    dateTimeStr (dt) { return Mdf.dtStr(dt) },

    // update page view
    doRefresh () {
      this.worksetSelected = this.worksetTextByName({ ModelDigest: this.digest, Name: this.worksetNameSelected })
      this.runCurrent = this.runTextByDigest({ ModelDigest: this.digest, RunDigest: this.runDigestSelected })

      // make list of model languages, description and notes for workset editor
      this.txtNewWorkset = []
      if (Mdf.isLangList(this.langList)) {
        for (const lcn of this.langList) {
          this.txtNewWorkset.push({
            LangCode: lcn.LangCode,
            LangName: lcn.Name,
            Descr: '',
            Note: ''
          })
        }
      } else {
        if (!this.txtNewWorkset.length) {
          this.txtNewWorkset.push({
            LangCode: this.modelLanguage.LangCode,
            LangName: this.modelLanguage.Name,
            Descr: '',
            Note: ''
          })
        }
      }
    },

    // show workset notes dialog
    doShowWorksetNote (name) {
      this.worksetInfoName = name
      this.worksetInfoTickle = !this.worksetInfoTickle
    },
    // show current run info dialog
    doShowRunNote (modelDgst, runDgst) {
      if (modelDgst !== this.digest || runDgst !== this.runDigestSelected) {
        console.warn('invlaid model digest or run digest:', modelDgst, runDgst)
        return
      }
      this.runInfoTickle = !this.runInfoTickle
    },

    // show or hide parameters tree
    onToogleShowParamTree () {
      this.isParamTreeShow = !this.isParamTreeShow
    },
    // show workset parameter notes dialog
    doShowParamNote (name) {
      this.paramInfoName = name
      this.paramInfoTickle = !this.paramInfoTickle
    },
    // show run parameter notes dialog
    doShowParamRunNote (name) {
      this.paramInfoName = name
      this.paramRunInfoTickle = !this.paramRunInfoTickle
    },
    // show group notes dialog
    doShowGroupNote (name) {
      this.groupInfoName = name
      this.groupInfoTickle = !this.groupInfoTickle
    },

    // clean new workset info
    resetNewWorkset () {
      this.nameOfNewWorkset = ''
      this.useBaseRun = false
      this.paramWsCopyLst = []
      this.paramRunCopyLst = []
      for (const t of this.txtNewWorkset) {
        t.Descr = ''
        t.Note = ''
      }
      this.newDescrNotes = []
    },
    // set default name of new workset
    onNewNameFocus (e) {
      if (typeof this.nameOfNewWorkset !== typeof 'string' || (this.nameOfNewWorkset || '') === '') {
        this.nameOfNewWorkset = 'New_' + Mdf.dtToUnderscoreTimeStamp(new Date())
      }
    },
    // check if new workset name entered and cleanup input to be compatible with file name rules
    onNewNameBlur (e) {
      const { isEntered, name } = Mdf.doFileNameClean(this.nameOfNewWorkset)
      this.nameOfNewWorkset = isEntered ? name : ''
    },
    // add workset parameter into parameters copy list
    onParamWorksetCopy (name) {
      this.addParamOrGroupFromWorksetCopy(name, false)
    },
    // add workset paramters group into parameters copy list
    onParamGroupWorksetCopy (name) {
      this.addParamOrGroupFromWorksetCopy(name, true)
    },
    // add workset parameter or paramters group into parameters copy list
    addParamOrGroupFromWorksetCopy (name, isGroup) {
      if (!Mdf.isNotEmptyWorksetText(this.worksetSelected)) {
        console.warn('Invalid (empty) workset to copy parameter from', name)
        return
      }
      this.addParamToCopyList(name, isGroup, this.paramWsCopyLst, this.paramRunCopyLst)
    },
    // add run parameter into parameters copy list
    onParamRunCopy (name) {
      this.addParamOrGroupFromRunCopy(name, false)
    },
    // add run paramters group into parameters copy list
    onParamGroupRunCopy (name) {
      this.addParamOrGroupFromRunCopy(name, true)
    },
    // add run parameter or paramters group into parameters copy list
    addParamOrGroupFromRunCopy (name, isGroup) {
      if (!Mdf.isNotEmptyRunText(this.runCurrent)) {
        console.warn('Invalid (empty) run to copy parameter from', name)
        return
      }
      this.addParamToCopyList(name, isGroup, this.paramRunCopyLst, this.paramWsCopyLst)
    },
    // add parameter name or parameters group name into parameters copy list
    // and remove from other copy list if present
    // for example: remove from run copy list if added into workset copy list
    addParamToCopyList (name, isGroup, copyLst, removeLst) {
      if (!name) {
        console.warn('Invalid (empty) parameter name to copy', name)
        return
      }
      // find parameter name or parameters group in the model
      let pg = {}

      if (!isGroup) {
        pg = Mdf.paramTextByName(this.theModel, name)
        if (!Mdf.isNotEmptyParamText(pg)) {
          console.warn('Invalid parameter to copy, not found in model parameters list:', name)
          return
        }
      } else {
        pg = Mdf.groupTextByName(this.theModel, name)
        if (!Mdf.isGroupText(pg) || !pg?.Group?.IsParam) {
          console.warn('Invalid parameters group to copy, not found in parameter groups list:', name)
          return
        }
      }

      // find index where to insert parameter name, if it is not already in the copy list
      const insPos = copyLst.findIndex((pn) => { return pn.name >= name })

      if (insPos >= 0 && insPos < copyLst.length && copyLst[insPos].name === name) return // parameter already in the list

      const pIns = {
        name: name,
        isGroup: isGroup,
        descr: Mdf.descrOfDescrNote(pg) || name
      }
      if (insPos >= 0 && insPos < copyLst.length) {
        copyLst.splice(insPos, 0, pIns)
      } else {
        copyLst.push(pIns)
      }

      this.removeParamFromCopyList(name, removeLst)
    },
    // remove workset parameter name or group name from parameters copy list
    onRemoveWsFromNewWorkset (name) {
      this.removeParamFromCopyList(name, this.paramWsCopyLst)
    },
    // remove run parameter name from parameters copy list
    onRemoveRunFromNewWorkset (name) {
      this.removeParamFromCopyList(name, this.paramRunCopyLst)
    },
    // remove parameter name or group name from parameters copy list
    removeParamFromCopyList (name, copyLst) {
      if (!name || !copyLst) return

      const rmPos = copyLst.findIndex((pn) => { return pn.name === name })
      if (rmPos >= 0 && rmPos < copyLst.length) {
        copyLst.splice(rmPos, 1)
      }
    },

    // validate and save new workset
    onSaveNewWorkset () {
      const name = Mdf.cleanFileNameInput(this.nameOfNewWorkset)
      if (name === '') {
        this.$q.notify({ type: 'negative', message: this.$t('Invalid (empty) input scenario name') + ((name || '') !== '' ? ': ' + (name || '') : '') })
        return
      }

      // collect description and notes for each language
      this.newDescrNotes = []

      for (const t of this.txtNewWorkset) {
        const refKey = 'new-ws-note-editor-' + t.LangCode
        if (!Mdf.isLength(this.$refs[refKey]) || !this.$refs[refKey][0]) continue

        const udn = this.$refs[refKey][0].getDescrNote()
        if ((udn.descr || udn.note || '') !== '') {
          this.newDescrNotes.push({
            LangCode: t.LangCode,
            Descr: udn.descr,
            Note: udn.note
          })
        }
      }

      // send request to create new workset
      this.createWorksetNow = true
    },
    // request to create workset completed
    doneWorksetCreate  (isSuccess, dgst, name) {
      this.createWorksetNow = false
      this.loadWorksetCreate = false
      this.nameOfNewWorkset = ''

      if (!isSuccess) return // workset not created: keep user on the same tab

      this.resetNewWorkset()

      if (dgst && name && dgst === this.digest) { // if the same model then refresh workset from server
        this.$emit('set-select', name)
      }
      this.$emit('tab-select', 'set-list', { digest: this.digest })
    }
  },

  mounted () {
    this.doRefresh()
    this.$emit('tab-mounted', 'new-set', { digest: this.digest })
  }
}
