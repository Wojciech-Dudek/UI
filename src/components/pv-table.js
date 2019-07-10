/*
Properties:

rowFields[], colFields[], otherFields[]: array of dimensions, example:
  {
    name: 'dim0',
    label: 'Salary',
    read: (r) => (r.DimIds.length > 0 ? r.DimIds[0] : void 0),
    selection: [],
    enums: [
      { value: 100, text: 'Low' },
      { value: 200, text: 'Medium' },
      { value: 300, text: 'High' }
    ]
  }

pvData: array of table rows, example:
    { DimIds: [100, 0], IsNull: false, Value: 895.5, ExprId: 0 }
  or:
    { DimIds: [10, 0], IsNull: false, Value: 0.1, SubId: 0 }
    ....
  dimension read() function expected to return enum value from row
  readValue() function expected to return table cell value
  processValue functions are used to aggregate cell value(s)
  formatValue function (if defined) is used to convert cell value to string
  dimension selection[] is an array of selected enums for each dimension

readValue(): function, example:
  readValue: (r) => (!r.IsNull ? r.Value : (void 0))

processValue{}: object with two methods,
  doNext() applied to each input row readValue() return, example:
  {
    // sum
    init: () => ({ result: void 0 }),
    doNext: (val, state) => {
      let v = parseFloat(val)
      if (!isNaN(v)) state.result = (state.result || 0) + v
      return state.result
    }
  }
  default processValue{} return value as is, (no conversion or aggregation)

formatValue(): function to convert cell value to display output, example:
    formatValue: (val) => (val.toFixed(2))
  if formatValue() undefined and it is not called

showRowColNames: true/false, if true then show row and column field label

refreshTickle: watch true/false, on change pivot table view updated
  it is recommended to set
    refreshTickle = !refreshTickle
  after pvData[] or any selection[] changed

refreshDimsTickle: watch true/false, on change deimension properties updated
  it is recommended to set
    refreshDimsTickle = !refreshDimsTickle
  after dimension arrays initialized (after init of: rowFields[], colFields[], otherFields[])
*/

import * as Pcvt from './pivot-cvt'

export default {

  props: {
    showRowColNames: {
      type: Boolean, default: false // if true then show row and column field names
    },
    refreshTickle: {
      type: Boolean, required: true // on refreshTickle change pivot table view updated
    },
    refreshDimsTickle: {
      type: Boolean, required: true // on refreshDimsTickle change enum labels updated
    },
    refreshValuesTickle: {
      type: Boolean, required: true // on refreshValuesTickle change cell values updated
    },
    rowFields: { type: Array, default: () => [] },
    colFields: { type: Array, default: () => [] },
    otherFields: { type: Array, default: () => [] },
    pvData: {
      type: Array, default: () => [] // input data as array of objects
    },
    readValue: {
      type: Function,
      required: true
    },
    processValue: {
      type: Object,
      default: Pcvt.asIsPval
    },
    formatValue: {
      type: Function,
      default: void 0 // disable format() value by default
    },
    isEditEnabled: { type: Boolean, default: false }, // if true then edit value is enabled
    cellClass: { type: String, default: 'pv-val-num' }
  },

  /* eslint-disable no-multi-spaces */
  data () {
    return {
      pvt: {
        rowCount: 0,  // table size: number of rows
        colCount: 0,  // table size: number of columns
        rows: [],     // for each row:    array of item keys
        cols: [],     // for each column: array of item keys
        rowKeys: [],  // for each table row:    itemsToKey(rows[i])
        colKeys: [],  // for each table column: itemsToKey(cols[j])
        cells: {},    // body cells values, object key: cellKey
        cellKeys: [], // keys of table body values ordered by [row index, column index]
        labels: {},   // row, column, other dimensions item labels, key: {dimensionName, itemCode}
        rowSpans: {}, // row span for each row label
        colSpans: {}  // column span for each column label
      },
      keyPos: [],         // position of each dimension item in cell key
      valueLen: 0,        // value input text size
      isSizeUpdate: false // if true then recalculate size and emit size event to parent
    }
  },
  /* eslint-enable no-multi-spaces */

  watch: {
    refreshTickle () {
      this.setData(this.pvData)
    },
    refreshDimsTickle () {
      this.setEnumLabels()
    },
    refreshValuesTickle () {
      for (const bkey in this.pvt.cells) {
        this.pvt.cells[bkey].value = this.formatValue ? this.formatValue(this.pvt.cells[bkey].src) : this.pvt.cells[bkey].src
      }
    }
  },

  methods: {
    // set enum labels for all dimensions: rows, columns, other
    setEnumLabels () {
      const makeLabels = (dims) => {
        for (let f of dims) {
          let ls = {}

          // make enum labels
          for (const e of f.enums) {
            ls[e.value] = e.text
          }
          this.pvt.labels[f.name] = ls
        }
      }

      this.pvt.labels = {}
      makeLabels(this.rowFields)
      makeLabels(this.colFields)
      makeLabels(this.otherFields)
    },

    // get enum label by dimension name and enum value
    getEnumLabel (dimName, enumValue) {
      return this.pvt.labels.hasOwnProperty(dimName) ? (this.pvt.labels[dimName][enumValue] || '') : ''
    },

    // update pivot table from input data page
    setData (d) {
      // clean existing view
      this.pvt.rowCount = 0
      this.pvt.colCount = 0
      this.pvt.rows = []
      this.pvt.cols = []
      this.pvt.rowKeys = []
      this.pvt.colKeys = []
      this.pvt.cells = {}
      this.pvt.cellKeys = []
      this.pvt.rowSpans = {}
      this.pvt.colSpans = {}
      this.keyPos = []
      this.valueLen = 0
      this.isSizeUpdate = false

      // if response is empty or invalid: clean table
      const len = (!!d && (d.length || 0) > 0) ? d.length : 0
      if (!d || len <= 0) {
        return
      }

      // make dimensions field selector:
      //  read dimension items from input record
      //  check if item is in dropdown filter values
      //  return comparator to sort items in the order of dimension enums
      const makeProc = (field, isRow = false, isCol = false) => {
        //
        let selected = Array(field.selection.length)
        for (let k = 0; k < field.selection.length; k++) {
          selected[k] = field.selection[k].value
        }

        return {
          isRow: isRow,
          isCol: isCol,
          name: field.name,
          keyPos: 0,
          read: field.read,
          filter: (v) => selected.includes(v),
          compare: (left, right) => {
            const nL = field.enums.findIndex(e => (left === e.value))
            const nR = field.enums.findIndex(e => (right === e.value))
            if (nL >= 0 && nR >= 0) {
              return nL - nR
            }
            if (nL >= 0 && nR < 0) return -1
            if (nL < 0 && nR >= 0) return 1
            return left < right ? -1 : (left > right ? 1 : 0)
          }
        }
      }

      let recProc = []
      let rCmp = []
      let cCmp = []
      for (const f of this.rowFields) {
        let p = makeProc(f, true, false)
        recProc.push(p)
        rCmp.push(p.compare)
      }
      for (const f of this.colFields) {
        let p = makeProc(f, false, true)
        recProc.push(p)
        cCmp.push(p.compare)
      }
      for (const f of this.otherFields) {
        recProc.push(makeProc(f, false, false))
      }
      for (const p of recProc) {
        if (!p.isRow && !p.isCol) continue
        for (const rp of recProc) {
          if (!rp.isRow && !rp.isCol) continue
          if (p.name > rp.name) p.keyPos++
        }
      }

      // process all input records: check if it match selection filters and aggregate values
      const rowKeyLen = this.rowFields.length
      const colKeyLen = this.colFields.length
      let vrows = []
      let vcols = []
      let rKeys = {}
      let cKeys = {}
      let vcells = {}
      let vstate = {}

      for (let k = 0; k < len; k++) {
        // check if record match selection filters
        let isSel = true
        let r = Array(rowKeyLen)
        let c = Array(colKeyLen)
        let b = Array(rowKeyLen + colKeyLen)
        let i = 0
        let j = 0
        for (const p of recProc) {
          let v = p.read(d[k])
          isSel = p.filter(v)
          if (!isSel) break
          if (p.isRow) {
            r[i++] = v
            b[p.keyPos] = v
          }
          if (p.isCol) {
            c[j++] = v
            b[p.keyPos] = v
          }
        }
        if (!isSel) continue // skip row: dimension item is not in filter values

        // build list of rows and columns keys
        let rk = Pcvt.itemsToKey(r)
        if (!rKeys[rk]) {
          rKeys[rk] = true
          vrows.push(r)
        }
        let ck = Pcvt.itemsToKey(c)
        if (!cKeys[ck]) {
          cKeys[ck] = true
          vcols.push(c)
        }

        // extract value(s) from record and aggregate
        let v = this.readValue(d[k])
        if (v === void 0 || v === null) continue // skip: empty value

        let bkey = Pcvt.itemsToKey(b)
        if (!vstate.hasOwnProperty(bkey)) {
          vstate[bkey] = this.processValue.init()
          vcells[bkey] = {key: bkey, src: v, value: void 0}
        }
        vcells[bkey].src = this.processValue.doNext(v, vstate[bkey])
      }

      // if format() not empty then format values
      for (const bkey in vcells) {
        vcells[bkey].value = this.formatValue ? this.formatValue(vcells[bkey].src) : vcells[bkey].src
      }

      // sort row keys and column keys in the order of dimension items
      const cmpKeys = (keyLen, aCmp) => {
        return (leftKey, rightKey) => {
          for (let k = 0; k < keyLen; k++) {
            let v = aCmp[k](leftKey[k], rightKey[k])
            if (v !== 0) return v
          }
          return 0
        }
      }
      vrows.sort(cmpKeys(rowKeyLen, rCmp))
      vcols.sort(cmpKeys(colKeyLen, cCmp))

      // calculate span for rows and columns
      const itemSpans = (keyLen, itemArr) => {
        if (!itemArr || itemArr.length < 1) return {} // no items: no rows or columns

        const nLen = itemArr.length
        let prev = Array(keyLen).fill('')
        let idx = Array(keyLen).fill(0)
        let itSpan = {}

        for (let i = 0; i < nLen; i++) {
          for (let j = 0; j < keyLen; j++) {
            if (itemArr[i][j] === prev[j]) { // if value same as previous then increase span
              itSpan[idx[j] * keyLen + j]++
              continue
            }
            // else new value: new span of all fields at this field and after
            for (let k = j; k < keyLen; k++) {
              prev[k] = itemArr[i][k]
              idx[k] = i
              itSpan[i * keyLen + k] = 1
            }
            break // next line: done with current fields - new span strated
          }
        }

        return itSpan
      }

      let rsp = itemSpans(rowKeyLen, vrows)
      let csp = itemSpans(colKeyLen, vcols)

      // max length of cell value as string
      let valLen = 0
      if (this.isEditEnabled) {
        for (const bkey in vcells) {
          if (typeof vcells[bkey].src !== typeof void 0) {
            let n = (vcells[bkey].src.toString() || '').length
            if (valLen < n) valLen = n
          }
        }
      }

      // sorted keys: row keys, column keys, body value keys
      const rowCount = vrows.length
      const colCount = vcols.length

      let vrk = Array(rowCount)
      let n = 0
      for (const r of vrows) {
        vrk[n++] = Pcvt.itemsToKey(r)
      }

      let vck = Array(colCount)
      n = 0
      for (const c of vcols) {
        vck[n++] = Pcvt.itemsToKey(c)
      }

      let nkp = Array(rowKeyLen + colKeyLen)
      for (let k = 0; k < recProc.length; k++) {
        if (recProc[k].isRow || recProc[k].isCol) {
          nkp[k] = {
            name: recProc[k].name, pos: recProc[k].keyPos
          }
        }
      }

      let b = Array(rowKeyLen + colKeyLen)
      let vkeys = Array(rowCount * colCount)
      n = 0
      for (const r of vrows) {
        for (let k = 0; k < rowKeyLen; k++) {
          b[nkp[k].pos] = r[k]
        }
        for (const c of vcols) {
          for (let k = 0; k < colKeyLen; k++) {
            b[nkp[rowKeyLen + k].pos] = c[k]
          }
          vkeys[n++] = Pcvt.itemsToKey(b)
        }
      }

      // done
      this.pvt.rowCount = rowCount
      this.pvt.colCount = colCount
      this.pvt.rows = Object.freeze(vrows)
      this.pvt.cols = Object.freeze(vcols)
      this.pvt.rowKeys = Object.freeze(vrk)
      this.pvt.colKeys = Object.freeze(vck)
      this.pvt.rowSpans = Object.freeze(rsp)
      this.pvt.colSpans = Object.freeze(csp)
      this.pvt.cells = Object.freeze(vcells)
      this.pvt.cellKeys = Object.freeze(vkeys)
      this.keyPos = nkp
      this.valueLen = valLen
      this.isSizeUpdate = this.isEditEnabled // update size only if edit value enabled
    }
  },

  updated () {
    if (!this.isSizeUpdate) return // size update not required

    // find max column client width
    let mw = 0

    if (this.colFields.length > 0) {
      let prf = 'cth-' + (this.colFields.length - 1).toString() + '-'

      for (let nCol = 0; nCol < this.pvt.colCount; nCol++) {
        let thLst = this.$refs[prf + nCol.toString()]
        if (thLst && (thLst.length || 0) > 0) {
          let n = thLst[thLst.length - 1].clientWidth || 0
          if (n > mw) mw = n
        }
      }
    }

    if (!mw) {
      let thPad = this.$refs.cthPad
      if (thPad) {
        let n = thPad.clientWidth || 0
        if (n > mw) mw = n
      }
    }

    // estimate input text size and send to parent
    if (mw) {
      let nc = Math.floor((mw - 9) / 9) - 1
      if (this.valueLen < nc) this.valueLen = nc
    }

    this.$emit('pvt-size', { rowCount: this.pvt.rowCount, colCount: this.pvt.colCount, valueLen: this.valueLen, keyPos: this.keyPos })
    this.isSizeUpdate = false
  },

  mounted () {
    this.setEnumLabels()
    this.setData(this.pvData)
  }
}