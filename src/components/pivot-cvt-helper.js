// pivot table value processing: helper functions

/* eslint-disable no-multi-spaces */
// editor type
export const EDIT_STRING = 0  // input type text
export const EDIT_NUMBER = 1  // input type text for float or integer
export const EDIT_BOOL = 2    // checkbox for boolean values
export const EDIT_ENUM = 3    // select drop-down for enum [id, label] list

export const PV_KEY_ITEM_SEP = String.fromCharCode(1) + '-'
export const PV_KEY_SCALAR = 'SCALAR_KEY'
/* eslint-enable no-multi-spaces */

// make row, column or body value key as join of row or column dimension items
export const itemsToKey = (items) => items.join(PV_KEY_ITEM_SEP)

// split row, column or body value key as into row or column dimension items
export const keyToItems = (key) => (key !== void 0 && key !== '') ? key.split(PV_KEY_ITEM_SEP) : []

// "parse" value as boolean, return undefined if value cannot treated as boolean
export const parseBool = (val) => {
  switch (val) {
    case true:
    case 1:
    case -1:
      return true
    case false:
    case 0:
      return false
    default:
      if (typeof val === typeof 'string') {
        switch (val.toLocaleLowerCase()) {
          case 'true':
          case 't':
          case '1':
          case 'yes':
          case 'y':
            return true
          case 'false':
          case 'f':
          case '0':
          case 'no':
          case 'n':
            return false
        }
      }
  }
  return void 0
}

// parse tab separated values into array
// return ragged array of [rows][columns], row count and max column size
export const parseTsv = (src, rowLimit = -1, colLimit = -1) => {
  // string expected as source
  const ret = {
    rowSize: 0, colSize: 0, arr: []
  }
  if (!src || typeof src !== typeof 'string') return ret // source is empty or invalid type

  // lines separated by cr-lf
  const lines = src.split(/\r\n|\r|\n/)
  ret.rowSize = (lines.length || 0)
  if (ret.rowSize > 0 && lines[ret.rowSize - 1] === '') ret.rowSize-- // ignore last line if it is empty

  if (ret.rowSize < 1 || (rowLimit > 0 && ret.rowSize > rowLimit)) return ret // source is empty or exceeded max row limit

  // columns separated by tab
  ret.arr = Array(ret.rowSize)
  for (let k = 0; k < ret.rowSize; k++) {
    const la = lines[k].split('\t')
    const n = la.length || 0

    if (ret.colSize < n) ret.colSize = n
    if (colLimit > 0 && ret.colSize > colLimit) return ret // exceeded max column size limit

    ret.arr[k] = n > 0 ? la : ['']
  }
  return ret
}

/* eslint-disable no-multi-spaces */

// set pivot state as rows, columns, others dimensions: name and selected items value(s) and editor state
/*
  {
    rows:   [ { name: ..., values: [...] }, {...} ],
    cols:   [ { name: ..., values: [...] }, {...} ],
    others: [ { name: ..., values: [...] }, {...} ],
    isRowColControls: true, // show or hide row-column controls
    rowColMode: 2,          // pivot table display mode: 0, 1 or 2
    edit: {
      // editor state and undo history
    }
  }
*/
export const pivotState = (rows, cols, others, isRowColControls, rowColMode, edit) => {
  const state = {
    rows: rows || [],
    cols: cols || [],
    others: others || [],
    isRowColControls: !!isRowColControls,
    rowColMode: typeof rowColMode === typeof 1 ? rowColMode : 2, // default: 2 = use spans and show dim names
    edit: emptyEdit()
  }

  // update editor state
  if (edit) state.edit = edit

  return state
}

// make pivot state by converting selected items for rows, columns, others dimensions into { name: ..., values: [...] }
export const pivotStateFromFields = (rows, cols, others, isRowColControls, rowColMode, edit) => {
  return pivotState(
    pivotStateFields(rows),
    pivotStateFields(cols),
    pivotStateFields(others),
    isRowColControls,
    rowColMode,
    edit
  )
}

// make pivot state fields part for each rows or columns or others dimensions:
//  dimension name and selected items value(s)
/*
  [
    {
      name:   'Age',
      values:  [10, 20, 30] // values are enum Ids, correspoding enum codes can be: ['age10', 'age20', 'age30']
    },
    {
      name:   'Sex',
      values:  [0, 1]       // values are enum Ids, correspoding enum codes can be: ['F', 'M']
    }
  ]
*/
export const pivotStateFields = (fields) => {
  if (!fields) return []
  const dst = []
  for (const f of fields) {
    const p = { name: f.name, values: [] }
    for (const v of f.selection) {
      p.values.push(v.value)
    }
    dst.push(p)
  }
  return dst
}

// return empty pivot editor state
export const emptyEdit = () => {
  return {
    isEnabled: false,   // if true then edit value
    kind: EDIT_STRING,  // default: string text input editor
    // current editor state
    isEdit: false,      // if true then edit in progress
    isUpdated: false,   // if true then cell value(s) updated
    cellKey: '',        // current eidtor focus cell
    cellValue: '',      // current eidtor input value
    updated: {},        // updated cells
    history: [],        // update history
    lastHistory: 0      // length of update history, changed by undo-redo
  }
}

// clean edit state and history
export const resetEdit = (edit) => {
  edit.isEdit = false
  edit.isUpdated = false
  edit.cellKey = ''
  edit.cellValue = ''
  edit.updated = {}
  edit.history = []
  edit.lastHistory = 0
}
/* eslint-enable no-multi-spaces */
