import json,struct,copy,io,argparse
import numpy as np
from PIL import Image
from pathlib import Path

def load(path):
 b=Path(path).read_bytes();n=struct.unpack_from('<I',b,12)[0];return json.loads(b[20:20+n]),b[28+n:]
parser=argparse.ArgumentParser(description='Prepare the CC0 Playza athlete. Requires numpy and Pillow.');parser.add_argument('--idle',required=True);parser.add_argument('--run',required=True);args=parser.parse_args();d,raw=load(args.idle);run,runraw=load(args.run);out=copy.deepcopy(d);out['bufferViews']=[];out['accessors']=[];buf=bytearray()
dtypes={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'};dims={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def arr(doc,blob,idx):
 a=doc['accessors'][idx];v=doc['bufferViews'][a['bufferView']];offset=v.get('byteOffset',0)+a.get('byteOffset',0);return np.frombuffer(blob,dtype=dtypes[a['componentType']],count=a['count']*dims[a['type']],offset=offset).reshape(a['count'],dims[a['type']]).copy()
def view(data):
 while len(buf)%4:buf.append(0)
 idx=len(out['bufferViews']);out['bufferViews'].append({'buffer':0,'byteOffset':len(buf),'byteLength':len(data)});buf.extend(data);return idx
def access(data,kind,component=5126):
 data=np.asarray(data,dtype=dtypes[component]);i=len(out['accessors']);a={'bufferView':view(data.tobytes()),'componentType':component,'count':len(data),'type':kind};
 if kind!='MAT4' and component==5126:a.update(min=data.min(axis=0).tolist(),max=data.max(axis=0).tolist())
 out['accessors'].append(a);return i
out['meshes']=[];keep={0,1,2,3,4,8,9,10,11};meshmap={}
for mi in sorted(keep):
 m=copy.deepcopy(d['meshes'][mi]);new=[]
 for prim in m['primitives']:
  indices=arr(d,raw,prim['indices']).reshape(-1,3);positions=arr(d,raw,prim['attributes']['POSITION']);centers=positions[indices].mean(axis=1)
  unique,inv=np.unique(indices,return_inverse=True);prim['indices']=access(inv.reshape(-1,1),'SCALAR',5125)
  for key,old in list(prim['attributes'].items()):
   olda=d['accessors'][old];values=arr(d,raw,old)[unique];component=olda['componentType'];normalized=False
   if key=='NORMAL':values=np.rint(values*32767);component=5122;normalized=True
   elif key=='WEIGHTS_0':
    values=np.rint(values*255).astype(np.int16);values[np.arange(len(values)),values.argmax(axis=1)]+=255-values.sum(axis=1);component=5121;normalized=True
   elif key=='JOINTS_0':component=5121
   elif key=='TEXCOORD_0' and values.min()>=0 and values.max()<=1:values=np.rint(values*65535);component=5123;normalized=True
   prim['attributes'][key]=access(values,olda['type'],component)
   if normalized:out['accessors'][prim['attributes'][key]]['normalized']=True
  new.append(prim)
 m['primitives']=new;meshmap[mi]=len(out['meshes']);out['meshes'].append(m)
for node in out['nodes']:
 if 'mesh'in node:
  if node['mesh']in meshmap:node['mesh']=meshmap[node['mesh']]
  else:node.pop('mesh',None);node.pop('skin',None)
for skin in out['skins']:skin['inverseBindMatrices']=access(arr(d,raw,skin['inverseBindMatrices']),'MAT4')
out['animations']=[]
for doc,blob in [(d,raw),(run,runraw)]:
 nodemap={i:next(j for j,n in enumerate(out['nodes']) if n.get('name')==node.get('name')) for i,node in enumerate(doc['nodes']) if any(n.get('name')==node.get('name') for n in out['nodes'])}
 for a in doc['animations']:
  a=copy.deepcopy(a)
  for c in a['channels']:c['target']['node']=nodemap[c['target']['node']]
  for sampler in a['samplers']:
   times=arr(doc,blob,sampler['input']);values=arr(doc,blob,sampler['output']);old=doc['accessors'][sampler['output']];keys=np.unique(np.r_[np.arange(0,len(times),2),len(times)-1]);sampler['input']=access(times[keys],'SCALAR')
   if sampler.get('interpolation')=='CUBICSPLINE':values=values.reshape(len(times),3,-1)[keys].reshape(-1,dims[old['type']])
   else:values=values[keys]
   sampler['output']=access(values,old['type'])
  out['animations'].append(a)
# Repack embedded textures at sizes suited to a phone-sized opponent.
for image in out['images']:
 v=d['bufferViews'][image['bufferView']];data=raw[v.get('byteOffset',0):v.get('byteOffset',0)+v['byteLength']];im=Image.open(io.BytesIO(data));size=1024 if 'diffuse2' in image.get('name','') else 256 if image.get('name')=='teeth' else 512;im.thumbnail((size,size));f=io.BytesIO()
 if im.mode=='RGBA' and im.getextrema()[3][0]<255:im.save(f,format='PNG',optimize=True);image['mimeType']='image/png'
 else:im.convert('RGB').save(f,format='JPEG',quality=85,optimize=True);image['mimeType']='image/jpeg'
 image['bufferView']=view(f.getvalue())
out['materials'][4]['name']='Playza coral performance jersey';out['materials'][4].setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[1,.32,.18,1];out['materials'][4]['pbrMetallicRoughness'].pop('baseColorTexture',None)
out['materials'][5]['name']='Playza navy training trousers';out['materials'][5].setdefault('pbrMetallicRoughness',{})['baseColorFactor']=[.035,.075,.15,1];out['materials'][5]['pbrMetallicRoughness'].pop('baseColorTexture',None)
out['materials'][10]['name']='Playza training shoes';out['materials'][10]['pbrMetallicRoughness']['baseColorFactor']=[.12,.18,.24,1]
out['asset']['extras']={'source':'Innerscene Sam / MakeHuman CC0','adaptation':'Playza sports training outfit; original idle and run animations; resized textures'}
while len(buf)%4:buf.append(0)
out['extensionsUsed']=list(set(out.get('extensionsUsed',[])+['KHR_mesh_quantization']));out['buffers']=[{'byteLength':len(buf)}];j=json.dumps(out,separators=(',',':')).encode();j+=b' '*((-len(j))%4)
result=struct.pack('<III',0x46546c67,2,12+8+len(j)+8+len(buf))+struct.pack('<II',len(j),0x4e4f534a)+j+struct.pack('<II',len(buf),0x004e4942)+buf
(Path(__file__).resolve().parents[1]/'public/beach-challenge/assets/playza-athlete.glb').write_bytes(result)
print('athlete bytes',len(result),'triangles',sum(out['accessors'][p['indices']]['count']//3 for m in out['meshes'] for p in m['primitives']))
