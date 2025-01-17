// server state and configuration

// return empty service configuration
export const emptyConfig = () => {
  return {
    RootDir: '',
    RowPageMaxSize: 100,
    AllowUserHome: false,
    AllowDownload: false,
    Env: {},
    ModelCatalog: {
      ModelDir: '',
      ModelLogDir: '',
      IsLogDirEnabled: false,
      LastTimeStamp: ''
    },
    RunCatalog: {
      RunTemplates: [],
      DefaultMpiTemplate: 'mpi.ModelRun.template.txt',
      MpiTemplates: []
    }
  }
}

// return true if this is service config (it can be empty)
export const isConfig = (c) => {
  if (!c) return false
  if (!c.hasOwnProperty('RootDir') || !c.hasOwnProperty('RowPageMaxSize') || !c.hasOwnProperty('AllowUserHome') || !c.hasOwnProperty('AllowDownload') ||
    !c.hasOwnProperty('Env') || !c.hasOwnProperty('ModelCatalog') || !c.hasOwnProperty('RunCatalog')) {
    return false
  }
  if (!c.ModelCatalog.hasOwnProperty('ModelDir') || !c.ModelCatalog.hasOwnProperty('ModelLogDir') || !c.ModelCatalog.hasOwnProperty('IsLogDirEnabled')) return false
  if (!c.RunCatalog.hasOwnProperty('RunTemplates') || !c.RunCatalog.hasOwnProperty('DefaultMpiTemplate') || !c.RunCatalog.hasOwnProperty('MpiTemplates')) return false

  return Array.isArray(c.RunCatalog.RunTemplates) && Array.isArray(c.RunCatalog.MpiTemplates)
}

// return value of server environemnt variable by key, if no such variable then return empty '' string
export const configEnvValue = (c, key) => {
  if (!isConfig(c)) return ''
  if (!c.Env.hasOwnProperty(key)) return ''
  return c.Env[key] || ''
}

/* eslint-disable no-multi-spaces */
/*
// DownloadStatusLog contains download status info and content of log file
type DownloadStatusLog struct {
  Status        string   // if not empty then one of: progress ready error
  Kind          string   // if not empty then one of: model, run, workset or delete
  ModelDigest   string   // content of "Model Digest:"
  RunDigest     string   // content of "Run  Digest:"
  WorksetName   string   // content of "Scenario Name:"
  IsFolder      bool     // if true then download folder exist
  Folder        string   // content of "Folder:"
  FolderModTime int64    // folder modification time in milliseconds since epoch
  IsZip         bool     // if true then download zip exist
  ZipFileName   string   // zip file name
  ZipModTime    int64    // zip modification time in milliseconds since epoch
  ZipSize       int64    // zip file size
  LogFileName   string   // log file name
  LogModTime    int64    // log file modification time in milliseconds since epoch
  Lines         []string // file content
}
*/
// return empty DownloadStatusLog
export const emptyDownloadLog = () => {
  return {
    Status: '',       // if not empty then one of: progress, ready, error
    Kind: '',         // if not empty then one of: model, run, workset or delete
    ModelDigest: '',
    RunDigest: '',
    WorksetName: '',
    IsFolder: false,  // if true then download folder exist
    Folder: '',       // folder name with unzipped download content
    FolderModTime: 0, // folder modification time in milliseconds since epoch
    IsZip: false,     // if true then download zip exist
    ZipFileName: '',  // zip file name
    ZipModTime: 0,    // zip modification time in milliseconds since epoch
    ZipSize: 0,       // zip file size
    LogFileName: '',  // log file name
    LogModTime: 0,    // log file modification time in milliseconds since epoch
    Lines: []         // log file lines
  }
}
/* eslint-enable no-multi-spaces */

export const allModelsDownloadLog = 'all-models-download-logs'

// return true if this is download log status info (it can be empty or incomplete)
export const isDownloadLog = (d) => {
  if (!d) return false
  if (!d.hasOwnProperty('Status') || !d.hasOwnProperty('Kind') ||
    !d.hasOwnProperty('ModelDigest') || !d.hasOwnProperty('RunDigest') || !d.hasOwnProperty('WorksetName') ||
    !d.hasOwnProperty('IsFolder') || !d.hasOwnProperty('Folder') || !d.hasOwnProperty('FolderModTime') ||
    !d.hasOwnProperty('IsZip') || !d.hasOwnProperty('ZipFileName') || !d.hasOwnProperty('ZipModTime') || !d.hasOwnProperty('ZipSize') ||
    !d.hasOwnProperty('LogFileName') || !d.hasOwnProperty('LogModTime') || !d.hasOwnProperty('Lines')) {
    return false
  }
  return Array.isArray(d.Lines)
}

// return true if each array element isDownloadLog()
export const isDownloadLogList = (dLst) => {
  if (!dLst) return false
  if (!Array.isArray(dLst)) return false
  for (let k = 0; k < dLst.length; k++) {
    if (!isDownloadLog(dLst[k])) return false
  }
  return true
}

/* eslint-disable no-multi-spaces */
/*
// PathItem contain basic file info after tree walk: relative path, size and modification time
type PathItem struct {
  Path    string // file path in / slash form
  IsDir   bool   // if true then it is a directory
  Size    int64  // file size (may be zero for directories)
  ModTime int64  // file modification time in milliseconds since epoch
}
*/
// return empty DownloadFileItem
export const emptyDownloadFileItem = () => {
  return {
    Path: '',     // file path in / slash form
    IsDir: false, // if true then it is a directory
    Size: 0,      // file size (may be zero for directories)
    ModTime: 0    // file modification time in milliseconds since epoch
  }
}
/* eslint-enable no-multi-spaces */

// return true if this is download file item
export const isDownloadFileItem = (fi) => {
  if (!fi) return false
  if (!fi.hasOwnProperty('Path') || typeof fi.Path !== typeof 'string' ||
    !fi.hasOwnProperty('IsDir') || typeof fi.IsDir !== typeof true ||
    !fi.hasOwnProperty('Size') || typeof fi.Size !== typeof 1 ||
    !fi.hasOwnProperty('ModTime') || typeof fi.ModTime !== typeof 1) {
    return false
  }
  return true
}

// return true if this is not enpty download file item
export const isNotEmptyDownloadFileItem = (fi) => {
  if (!isDownloadFileItem(fi)) return false
  return (fi.Path || '') !== ''
}

// return true if each array element isDownloadFileItem()
export const isDownloadFileTree = (pLst) => {
  if (!pLst) return false
  if (!Array.isArray(pLst)) return false
  for (let k = 0; k < pLst.length; k++) {
    if (!isDownloadFileItem(pLst[k])) return false
  }
  return true
}
