import * as THREE from '../node_modules/three/src/Three';
import { raycaster, setHover } from './shared';
import { onDimMoveEnd } from './drawDimension'

let ptLoc

export function onHover(e) {
  // if ((this.mode && this.mode != 'dimension' && !this.snap) || e.buttons) return
  if (e.buttons) return

  raycaster.setFromCamera(
    new THREE.Vector2(
      (e.clientX - this.rect.left) / this.rect.width * 2 - 1,
      - (e.clientY - this.rect.top) / this.rect.height * 2 + 1
    ),
    this.camera
  );

  let hoverPts;


  if (this.obj3d.userData.type != 'sketch') {
    this.selpoints[0].visible = false // hide selpoint[0] before each redraw
    raycaster.layers.set(1)
    hoverPts = raycaster.intersectObjects(this.obj3d.children, true)
  } else {
    // this.freePt.visible = false // hide freept before each redraw
    this.scene.selpoints[0].visible = false // hide selpoint[0] before each redraw
    raycaster.layers.set(2)
    // intersectObjects has side effect of updating bounding spheres
    // which may lead to unexpected results if you leave boundspheres un-updated
    hoverPts = raycaster.intersectObjects([...this.dimGroup.children, ...this.obj3d.children])
  }


  let idx = []

  const thresh = this.snap ? 1 : 0.0001
  if (hoverPts.length) {
    // console.log('here', hoverPts)
    let minDist = Infinity;
    for (let i = 0; i < hoverPts.length; i++) {
      if (!hoverPts[i].distanceToRay) continue;
      if (hoverPts[i].distanceToRay < minDist - thresh) {
        idx = [i]
        if (this.obj3d.userData.type != 'sketch') break
        minDist = hoverPts[i].distanceToRay
      } else if (hoverPts[i].distanceToRay < minDist + thresh) {
        idx.push(i)
      }
    }

    if (!idx.length && !this.snap) {
      idx.push(0)
    }

  }


  if (idx.length) { // after filtering, if hovered objs still exists

    if (hoverPts[idx[0]].object != this.hovered[0]) { // if the previous hovered obj is not the same as current

      for (let x = 0; x < this.hovered.length; x++) { // first clear old hovers that are not selected

        const obj = this.hovered[x]
        if (typeof obj == 'object' && !this.selected.includes(obj)) {
          setHover(obj, 0)
        }
      }
      this.hovered = []

      for (let x = 0; x < idx.length; x++) {
        let obj = hoverPts[idx[x]].object

        setHover(obj, 1, false)


        if (this.obj3d.userData.type != 'sketch' && obj.userData.type == 'point') {
          ptLoc = obj.geometry.attributes.position.array
            .slice(
              3 * hoverPts[idx[x]].index,
              3 * hoverPts[idx[x]].index + 3
            )
          this.selpoints[0].geometry.attributes.position.array.set(ptLoc)
          this.selpoints[0].matrix = obj.parent.matrix
          this.selpoints[0].geometry.attributes.position.needsUpdate = true
          this.selpoints[0].visible = true

          obj = hoverPts[idx[x]].index
        }

        if (this.obj3d.userData.type == 'sketch' && obj.userData.type == 'point') {
          // ptLoc = obj.geometry.attributes.position.array
          //   .slice(
          //     3 * hoverPts[idx[x]].index,
          //     3 * hoverPts[idx[x]].index + 3
          //   )
          // this.freePt.geometry.attributes.position.array.set(ptLoc)
          // this.freePt.matrix = obj.parent.matrix
          // this.freePt.geometry.attributes.position.needsUpdate = true
          // this.freePt.visible = true
          ptLoc = obj.geometry.attributes.position.array
            .slice(
              3 * hoverPts[idx[x]].index,
              3 * hoverPts[idx[x]].index + 3
            )
          this.scene.selpoints[0].geometry.attributes.position.array.set(ptLoc)
          this.scene.selpoints[0].matrix = obj.parent.matrix
          this.scene.selpoints[0].geometry.attributes.position.needsUpdate = true
          this.scene.selpoints[0].visible = true
        }


        this.hovered.push(obj)
      }

      // console.log('render1')
      this.obj3d.dispatchEvent({ type: 'change' })
    }
  } else { // no hovered object after filtering
    if (this.hovered.length) { // if previously something was hovered, then we need to clear it


      for (let x = 0; x < this.hovered.length; x++) {
        const obj = this.hovered[x]

        if (typeof obj == 'object' && !this.selected.includes(obj)) {
          setHover(obj, 0)
        }


      }
      this.hovered = []

      // console.log('render2')
      this.obj3d.dispatchEvent({ type: 'change' })
    }
  }


}

let draggedLabel;
export function onPick(e) {
  if ((this.mode && this.mode != 'dimension') || e.buttons != 1) return

  if (this.hovered.length) {
    let obj = this.hovered[this.hovered.length - 1]
    // if (sc.selected.includes(obj3d)) continue

    console.log(obj, 'heere')
    if (typeof obj != 'object') { // special sketchplace define pts in feature mode

      const pp = this.selpoints[this.fptIdx % 3 + 1]
      const p0 = this.selpoints[0]

      pp.geometry.attributes.position.array.set(p0.geometry.attributes.position.array)
      pp.matrix = p0.matrix
      pp.geometry.attributes.position.needsUpdate = true
      pp.visible = true

      obj = pp
      this.fptIdx++


      const idx = this.selected.indexOf(obj)
      if (idx == -1) {
        this.selected.push(
          obj
        )
      } else {
        this.selected.splice(idx, 1, obj)
      }

    } else {

      const idx = this.selected.indexOf(obj)
      if (idx == -1) {
        this.selected.push(
          obj
        )
        this.setHover(obj, 1)

      } else {

        this.setHover(this.selected[idx], 0)

        this.selected.splice(idx, 1)

      }
    }


    this.obj3d.dispatchEvent({ type: 'change' })

    if (this.obj3d.userData.type != 'sketch') {
      return;
    }

    switch (obj.userData.type) {
      case 'dimension':
        const idx = this.dimGroup.children.indexOf(this.hovered[0])
        if (idx % 2) { // we only allow tag point (odd idx) to be dragged
          this.onDragDim = this._onMoveDimension(
            this.dimGroup.children[idx],
            this.dimGroup.children[idx - 1],
          )
          this.canvas.addEventListener('pointermove', this.onDragDim);
          this.canvas.addEventListener('pointerup', () => {
            onDimMoveEnd(this.dimGroup.children[idx])
            this.onRelease()
          })
        }

        draggedLabel = this.dimGroup.children[idx].label
        draggedLabel.style.zIndex = -1;
        break;
      case 'point':

        this.canvas.addEventListener('pointermove', this.onDrag);
        this.canvas.addEventListener('pointerup', this.onRelease)
        break;

      default:
        break;
    }

  } else {
    for (let x = 0; x < this.selected.length; x++) {
      const obj = this.selected[x]


      if (obj.userData.type == 'selpoint') {
        obj.visible = false
      } else {
        setHover(obj, 0)

      }

      // dont think this would have been possible without redux
      if (obj.userData.type == 'sketch' && !sc.store.getState().treeEntries.visible[obj.name]) {
        obj.visible = false
      }


    }
    this.obj3d.dispatchEvent({ type: 'change' })
    this.selected = []
  }
}

export function onDrag(e) {

  // const obj = this.hovered[this.hovered.length-1]
  // this.ptsBuf.set(
  //   this.getLocation(e).toArray(),
  //   this.objIdx.get(obj.name) * 3
  // )

  for (let x = 0; x < this.hovered.length; x++) {
    const obj = this.hovered[x]
    this.ptsBuf.set(
      this.getLocation(e).toArray(),
      this.objIdx.get(obj.name) * 3
    )
  }

  this.solve()
  this.scene.render()
}




export function onRelease(e) {
  this.canvas.removeEventListener('pointermove', this.onDrag)
  this.canvas.removeEventListener('pointermove', this.onDragDim)
  this.canvas.removeEventListener('pointerup', this.onRelease)

  this.updateBoundingSpheres()

  if (draggedLabel) {
    draggedLabel.style.zIndex = 0;
  }
}

export function clearSelection() {
  for (let x = 0, obj; x < this.selected.length; x++) {
    obj = this.selected[x]
    if (obj.userData.type == 'selpoint') {
      obj.visible = false
    } else {
      setHover(obj, 0)
    }
  }
  this.selected = []

  for (let x = 0; x < this.hovered.length; x++) {

    const obj = this.hovered[x]
    setHover(obj, 0)


  }

}
