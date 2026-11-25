# Blender step of scripts/objects/scan-to-glb.ts (run by it; not on its own).
#
# A scanned or modelled object (OBJ / FBX / GLB / glTF / USDZ) → a geometry-only GLB in the
# gallery's Object contract (docs/objects/README.md "The GLB contract"): +Y up, 1 unit = 1 m, the
# base on y = 0, centred on the base, the front facing +Z (the room's front); loose scan debris
# removed; one UV set; MikkTSpace tangents for normal maps; materials kept by name WITHOUT images
# (the textures are rebuilt, smaller, by glTF-Transform). Writes three textured previews and prints
# one line `RESULT {json}`: the analysis, the real size and each material's texture files.
#
#   Blender -b -P scripts/objects/prep-scan.py -- <in> <out.glb> <name> <preview prefix> <turn°> <min island share>
import bpy, bmesh, sys, os, math, json, mathutils

argv = sys.argv[sys.argv.index('--') + 1:]
src, dst, name, prev = argv[:4]
TURN = float(argv[4]) if len(argv) > 4 else 0.0  # degrees about the vertical, counterclockwise from above
MIN_SHARE = float(argv[5]) if len(argv) > 5 else 0.005  # islands under 0.5 % of the faces = debris
tex_dir = os.path.dirname(os.path.abspath(dst))

bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(src)[1].lower()
if ext == '.obj':
    # Scanning apps write Y up, as glTF.
    bpy.ops.wm.obj_import(filepath=src, forward_axis='NEGATIVE_Z', up_axis='Y')
elif ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=src)
elif ext in ('.glb', '.gltf'):
    bpy.ops.import_scene.gltf(filepath=src)
elif ext in ('.usdz', '.usd', '.usdc', '.usda'):
    bpy.ops.wm.usd_import(filepath=src)
else:
    raise SystemExit(f'unsupported file type {ext}')

# One mesh object: join the parts, apply every transform into the mesh.
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
if not meshes:
    raise SystemExit('no mesh in the file')
bpy.ops.object.select_all(action='DESELECT')
for m in meshes:
    m.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
o = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
o.name = name; o.data.name = name
for x in list(bpy.context.scene.objects):
    if x != o:
        bpy.data.objects.remove(x)


def bounds():
    vs = [v.co for v in o.data.vertices]
    lo = mathutils.Vector([min(v[i] for v in vs) for i in range(3)])
    hi = mathutils.Vector([max(v[i] for v in vs) for i in range(3)])
    return lo, hi


def islands_of(bm):
    seen, out = set(), []
    for f in bm.faces:
        if f.index in seen:
            continue
        comp, stack = [f], [f]
        seen.add(f.index)
        while stack:
            g = stack.pop()
            for e in g.edges:
                for h in e.link_faces:
                    if h.index not in seen:
                        seen.add(h.index); stack.append(h); comp.append(h)
        out.append(comp)
    return out


def analyse():
    bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
    parts = sorted((len(c) for c in islands_of(bm)), reverse=True)
    out = {
        'vertices': len(bm.verts),
        'triangles': sum(len(f.verts) - 2 for f in bm.faces),
        'parts': len(parts),
        'largestParts': parts[:5],
        'holeEdges': sum(1 for e in bm.edges if e.is_boundary),
        'nonManifoldEdges': sum(1 for e in bm.edges if not e.is_manifold and not e.is_boundary),
        'degenerateFaces': sum(1 for f in bm.faces if f.calc_area() < 1e-12),
        'uvSets': len(o.data.uv_layers),
    }
    bm.free()
    return out


before = analyse()

# Loose debris (floating specks a scan picks up): parts under MIN_SHARE of the faces.
bm = bmesh.new(); bm.from_mesh(o.data); bm.faces.ensure_lookup_table()
total = len(bm.faces)
drop = [f for comp in islands_of(bm) if len(comp) < total * MIN_SHARE for f in comp]
bmesh.ops.delete(bm, geom=drop, context='FACES')
bmesh.ops.dissolve_degenerate(bm, dist=1e-7, edges=bm.edges[:])
bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
bm.to_mesh(o.data); bm.free()

# Face the front: turn about the vertical (Blender Z), then the base on z = 0, centred on it.
if TURN:
    o.data.transform(mathutils.Matrix.Rotation(math.radians(TURN), 4, 'Z'))
lo, hi = bounds()
o.data.transform(mathutils.Matrix.Translation(-mathutils.Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))))
o.data.update()
lo, hi = bounds()
size = hi - lo
after = analyse()

uvs = o.data.uv_layers
while len(uvs) > 1:
    uvs.remove(uvs[-1])
if len(uvs):
    uvs[0].name = 'UVMap'


# Each material's texture files: the image feeding Base Color, and the one feeding a Normal Map.
def image_file(img):
    if img.packed_file is not None or not img.filepath:
        path = os.path.join(tex_dir, f'{name}-{img.name}.png'.replace(' ', '_'))
        img.filepath_raw = path; img.file_format = 'PNG'; img.save()
        return path
    return os.path.abspath(bpy.path.abspath(img.filepath))


def source_image(socket):
    for link in socket.links:
        n = link.from_node
        if n.type == 'TEX_IMAGE' and n.image:
            return n.image
        for inp in n.inputs:
            found = source_image(inp)
            if found:
                return found
    return None


materials = []
for slot in o.material_slots:
    m = slot.material
    if m is None:
        continue
    entry = {'name': m.name, 'baseColor': None, 'normal': None}
    if m.node_tree is not None:
        bsdf = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        if bsdf:
            img = source_image(bsdf.inputs['Base Color'])
            entry['baseColor'] = image_file(img) if img else None
            normal_map = next((l.from_node for l in bsdf.inputs['Normal'].links), None)
            if normal_map is not None and normal_map.type == 'NORMAL_MAP':
                img = source_image(normal_map.inputs['Color'])
                entry['normal'] = image_file(img) if img else None
    materials.append(entry)

# Previews, the diffuse on the surface: front (the side facing +Z in glTF), side, three-quarter.
scene = bpy.context.scene
scene.render.engine = 'BLENDER_WORKBENCH'
scene.display.shading.light = 'STUDIO'
scene.display.shading.color_type = 'TEXTURE'
scene.render.film_transparent = True
scene.render.resolution_x = 700; scene.render.resolution_y = 900
centre = (lo + hi) / 2; reach = size.length
for label, az, el in (('front', 0, 8), ('side', 90, 8), ('angle', -35, 30)):
    cam = bpy.data.objects.new(label, bpy.data.cameras.new(label))
    scene.collection.objects.link(cam)
    a, e = math.radians(az), math.radians(el)
    d = reach * 1.25
    cam.location = centre + mathutils.Vector((math.sin(a) * math.cos(e) * d, -math.cos(a) * math.cos(e) * d, math.sin(e) * d))
    cam.rotation_euler = (centre - cam.location).to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 50
    scene.camera = cam
    scene.render.filepath = f'{prev}-{label}.png'
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)

# Export: no image nodes, so nothing full-size is embedded (glTF-Transform adds the textures).
for slot in o.material_slots:
    m = slot.material
    if m is not None and m.node_tree is not None:
        for n in list(m.node_tree.nodes):
            if n.type in ('TEX_IMAGE', 'NORMAL_MAP', 'BUMP'):
                m.node_tree.nodes.remove(n)
bpy.ops.export_scene.gltf(
    filepath=dst, export_format='GLB', export_yup=True, export_apply=True,
    export_texcoords=True, export_normals=True,
    export_tangents=any(m['normal'] for m in materials),
    export_materials='EXPORT', export_image_format='NONE',
    export_cameras=False, export_lights=False, export_animations=False,
    export_draco_mesh_compression_enable=False,
)

print('RESULT ' + json.dumps({
    'before': before,
    'after': after,
    'removedDebrisFaces': before['triangles'] - after['triangles'] if before['triangles'] >= after['triangles'] else 0,
    # Blender: x = width, y = depth, z = height (front facing -Y, glTF +Z).
    'sizeCm': {'h': round(size.z * 100, 1), 'w': round(size.x * 100, 1), 'd': round(size.y * 100, 1)},
    'materials': materials,
}))
