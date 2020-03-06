"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const orNone = v => (v != undefined ? v : '');
function atomSnapshot(atom) {
    const { uid, id, _name, metaMap, children, grandChildren } = atom;
    const meta = metaMap ? [...metaMap.keys()] : '';
    let size = children.size;
    if (grandChildren)
        size += grandChildren.size;
    const value = atom.value ? JSON.parse(JSON.stringify(atom.value)) : '';
    return [uid, orNone(id), orNone(_name), orNone(meta), value, size];
}
exports.atomSnapshot = atomSnapshot;
