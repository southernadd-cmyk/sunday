#!/usr/bin/env python3
"""Original low-resolution football art. Update native source and export atlas
rectangles in place, preserving Construct's dimensions, frame IDs and UVs.
Only RGBA, non-interlaced PNGs are supported, matching the existing export."""
from pathlib import Path
import json, random, struct, zlib, math, copy

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'construct'/'images'
WEB=ROOT/'public'/'construct'
def chunk(kind, payload):
    return struct.pack('>I',len(payload))+kind+payload+struct.pack('>I',zlib.crc32(kind+payload)&0xffffffff)
def rgba(hexcolor):
    if hexcolor is None:return (0,0,0,0)
    return tuple(bytes.fromhex(hexcolor.lstrip('#')))+(255,)
def png(w,h,pixels):
    raw=b''.join(b'\x00'+bytes(pixels[y*w*4:(y+1)*w*4]) for y in range(h))
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(raw,9))+chunk(b'IEND',b'')
def read_png(path):
    data=path.read_bytes();off=8;parts=[]
    while off<len(data):
        n=struct.unpack_from('>I',data,off)[0];kind=data[off+4:off+8];body=data[off+8:off+8+n];off+=n+12
        if kind==b'IHDR':
            w,h,depth,color,compression,filtering,interlace=struct.unpack('>IIBBBBB',body)
            assert (depth,color,compression,filtering,interlace)==(8,6,0,0,0),path
        elif kind==b'IDAT':parts.append(body)
    raw=zlib.decompress(b''.join(parts));stride=w*4;out=bytearray();prev=bytearray(stride)
    for y in range(h):
        f=raw[y*(stride+1)];row=bytearray(raw[y*(stride+1)+1:(y+1)*(stride+1)])
        for x in range(stride):
            a=row[x-4] if x>=4 else 0;b=prev[x];c=prev[x-4] if x>=4 else 0
            p=a+b-c;pa=abs(p-a);pb=abs(p-b);pc=abs(p-c)
            v=0 if f==0 else a if f==1 else b if f==2 else (a+b)//2 if f==3 else (a if pa<=pb and pa<=pc else b if pb<=pc else c)
            row[x]=(row[x]+v)&255
        out.extend(row);prev=row
    return w,h,out
class Canvas:
    def __init__(self,w,h,bg=None):
        self.w=w;self.h=h;self.data=bytearray(rgba(bg))*(w*h)
    def pixel(self,x,y,c):
        if 0<=x<self.w and 0<=y<self.h:
            i=(y*self.w+x)*4;self.data[i:i+4]=bytes(rgba(c) if isinstance(c,str) or c is None else c)
    def rect(self,x,y,w,h,c):
        color=bytes(rgba(c) if isinstance(c,str) or c is None else c)
        left=max(0,x);right=min(self.w,x+w)
        if right<=left:return
        line=color*(right-left)
        for yy in range(max(0,y),min(self.h,y+h)):
            start=(yy*self.w+left)*4;self.data[start:start+len(line)]=line
    def line(self,x,y,X,Y,c,width=1):
        n=max(abs(X-x),abs(Y-y),1)
        for i in range(n+1):
            self.rect(round(x+(X-x)*i/n),round(y+(Y-y)*i/n),width,width,c)
    def ellipse(self,x,y,rx,ry,c,outline=False):
        for yy in range(y-ry-1,y+ry+2):
            for xx in range(x-rx-1,x+rx+2):
                d=((xx-x)/rx)**2+((yy-y)/ry)**2
                if (abs(d-1)<max(2/rx,2/ry) if outline else d<=1):self.pixel(xx,yy,c)
    def save(self,path):
        path.write_bytes(png(self.w,self.h,self.data))
# Original 16x16 sprites: eight directions, idle + four running poses + slide.
# Each pixel pose is drawn with a stable foot anchor. No rotation of raster art.
DIRECTIONS=[(0,-1),(1,-1),(1,0),(1,1),(0,1),(-1,1),(-1,0),(-1,-1)]
POSES=6
def footballer(team,frame):
    direction,pose=divmod(frame,POSES)
    dx,dy=DIRECTIONS[direction]
    p=Canvas(16,16);r=p.rect
    kits=[('df3830','892423','ff6550'),('3670c4','263e84','6ca8ed'),('dcb341','947027','ffe181'),('414750','22282e','7c8690')]
    light,shade,highlight=kits[team];skin=['edb17e','ce9864','f1c890','b78558'][team];hair=['4c3024','39291e','795534','31271f'][team]
    shorts='ece8ca' if team in (0,1) else '303943';dark='292b29'
    p.ellipse(8,14,5,1,(17,39,20,120))
    def limb(x,y,X,Y,c,w=2):
        p.line(round(x),round(y),round(X),round(Y),c,w)
    # Slide uses a low, extended silhouette with the kit and head still visible.
    if pose==5:
        vx,vy=dx,dy
        if not vx:vx=1 if vy>0 else -1
        sx=1 if vx>0 else -1
        r(6-sx*2,9,5,4,dark);r(7-sx*2,9,4,3,light)
        r(7+sx,11,4,3,shorts)
        limb(8+sx,12,8+sx*4,13,light);r(8+sx*4-1,14,3,1,dark)
        r(6-sx*4,8,4,4,hair);r(6-sx*4+1,10,3,2,skin)
        return p
    # Feet move in the direction of travel, four poses including crossing.
    # Side-on frames have a narrower torso; front/back distinguish head and kit.
    phase=(0,2,0,-2)[pose-1] if pose else 0
    cross=(0,1,0,-1)[pose-1] if pose else 0
    side=abs(dx)==1 and dy==0
    cx=8;bodyw=4 if side else 6
    bob=1 if pose in (2,4) else 0
    y=6-bob
    for sign in (-1,1):
        hx=cx+sign*(1 if side else 2);hy=10-bob
        fx=hx+dx*phase*sign;fy=13+round(dy*phase*sign*.55)
        limb(hx,hy,fx,fy-1,shorts)
        r(round(fx),round(fy)-1,2,2,light)
        r(round(fx)-1,round(fy)+1,3,1,dark)
    r(cx-bodyw//2-1,y,bodyw+2,5,dark)
    r(cx-bodyw//2,y,bodyw,4,light)
    r(cx-bodyw//2,y,1,3,highlight);r(cx+bodyw//2-1,y+1,1,3,shade)
    if dy<0:r(cx-1,y+1,2,2,highlight) # shirt number suggestion, back-facing
    for sign in (-1,1):
        ax=cx+sign*(bodyw//2+1);ay=y+1
        limb(ax,ay,ax+dx*cross*sign,ay+2+round(dy*cross*sign*.5),shade,1)
        r(ax+dx*cross*sign,ay+3+round(dy*cross*sign*.5),1,1,skin)
    headx=cx-2+dx;heady=2-bob
    r(headx-1,heady,6,5,dark);r(headx,heady,4,4,hair)
    if dy>0:
        r(headx,heady+2,4,2,skin);r(headx+1,heady+2,1,1,'76523e');r(headx+3,heady+2,1,1,'76523e')
    elif dx:
        r(headx+(3 if dx>0 else 0),heady+2,2,2,skin)
        if dy==0:r(headx+(4 if dx>0 else 0),heady+2,1,1,'5a4032')
    else:r(headx+1,heady+3,2,1,skin)
    return p

def build_directional_atlas(data):
    # Keep the native object's animation names/SIDs. Expand its frame arrays
    # in the project source and existing exported data, using a dedicated atlas.
    count=len(DIRECTIONS)*POSES;cols=16;cell=18
    atlas=Canvas(cols*cell,math.ceil(4*count/cols)*cell)
    source=ROOT/'construct'/'objectTypes'/'Footballer.json'
    project=json.loads(source.read_text())
    exported=next(o for o in data['project'][3] if o[0]=='Footballer')
    path='images/sunday-directional.png'
    for team,name in enumerate(('Home','Away','Keeper','Official')):
        anim=next(a for a in project['animations']['items'] if a['name']==name)
        native=next(a for a in exported[7] if a[0]==name)
        template=copy.deepcopy(anim['frames'][0]);template['originX']=.5;template['originY']=.94
        frame_template=list(native[7][0]);frames=[];export_frames=[]
        for index in range(count):
            img=footballer(team,index);img.save(SRC/f'footballer-{name.lower()}-{index:03}.png')
            slot=team*count+index;x=slot%cols*cell+1;y=slot//cols*cell+1
            for row in range(16):
                start=((y+row)*atlas.w+x)*4
                atlas.data[start:start+64]=img.data[row*64:(row+1)*64]
            meta=copy.deepcopy(template);meta['imageSpriteId']=18100000+slot;frames.append(meta)
            desc=list(frame_template);desc[:7]=[path,0,x,y,16,16,False];export_frames.append(desc)
        anim['frames']=frames;native[7]=export_frames
    atlas.save(WEB/path)
    for anim in exported[7]:
        for frame in anim[7]:frame[1]=(WEB/path).stat().st_size
    source.write_text(json.dumps(project,indent=2)+'\\n')
    print('Built 192 original directional footballer frames in the native project and export.')
def pitch():
    p=Canvas(528,660,'304b32');rng=random.Random(1926)
    def xy(x,z):return round((x+44)*6),round((z+55)*6)
    def box(x,z,w,h,c):
        a,b=xy(x,z);X,Y=xy(x+w,z+h);p.rect(a,b,X-a,Y-b,c)
    def line(x,z,X,Z,c='e3e9c2',width=2):
        a,b=xy(x,z);a2,b2=xy(X,Z);p.line(a,b,a2,b2,c,width)
    def outline(x,z,w,h,c='e3e9c2',width=2):
        line(x,z,x+w,z,c,width);line(x+w,z,x+w,z+h,c,width);line(x+w,z+h,x,z+h,c,width);line(x,z+h,x,z,c,width)
    # Surround: worn recreation-ground paths, a rail and two modest touchline
    # crowds rather than a giant stadium. The playing surface has mown stripes.
    box(-44,-55,88,110,'416147')
    box(-42,-53,84,106,'53674a')
    box(-38,-52,76,104,'294d36')
    for i in range(12):
        box(-36,-52+i*104/12,72,104/12,('5a9e3b','4e9035')[i%2])
    for _ in range(3400):
        x=rng.randrange(48,480);y=rng.randrange(18,642)
        p.pixel(x,y,rng.choice(['609f3e','4d8d34','64a243','498632']))
    # Goal mouths and centre circle wear, stippled to keep pitch markings clear.
    for z in (-44,44):
        cx,cy=xy(0,z)
        for _ in range(850):
            x=rng.randrange(cx-48,cx+49);y=rng.randrange(cy-16,cy+17)
            if ((x-cx)/48)**2+((y-cy)/16)**2<rng.random():
                p.pixel(x,y,rng.choice(['77764d','7b8151','60834b']))
    outline(-34,-47,68,94);line(-34,0,34,0)
    # Enclosed five-a-side boards: dark lower rail and cream top edge.
    for side in (-1,1):
        x=side*34;line(x+side*.5,-47,x+side*.5,47,'2d5030',3);line(x+side*.8,-47,x+side*.8,47,'d4d4a6',2)
    cx,cy=xy(0,0);p.ellipse(cx,cy,55,55,'e3e9c2',True);p.rect(cx-1,cy-1,3,3,'f4f2d4')
    for sign in (-1,1):
        z=-47 if sign==-1 else 29;outline(-20,z,40,18)
        outline(-9,-47 if sign==-1 else 41,18,6)
        cx,cy=xy(0,sign*35);p.rect(cx-1,cy-1,3,3,'f4f2d4')
        # Goal frame and offset shadow, woven net.
        z=-51 if sign==-1 else 47;box(-6.1,z,12.2,4,'294b3b');outline(-6.1,z,12.2,4,'f4f2d4',3)
        for i in range(-5,6):line(i,z,i,z+4,'8ca798',1)
        for j in range(1,4):line(-6.1,z+j,6.1,z+j,'8ca798',1)
        for side in (-1,1):
            x=side*34;line(x,sign*47,x-side*1.5,sign*47,'f3ecaf',2)
    for side in (-1,1):
        rail=side*38;line(rail,-48,rail,48,'c6c2a2',2)
        for z in range(-48,49,8):
            a,b=xy(rail,z);p.rect(a-1,b-2,3,5,'dbd2b1')
        for j in range(20):
            x=side*(40+rng.randrange(0,2));z=-46+j*4.7+rng.uniform(-.9,.9)
            a,b=xy(x,z);coat=rng.choice(['ba9b65','a65c50','7a86a8','c7c7ae','527e82','3e4354'])
            p.rect(a-3,b+3,7,4,'2a4236');p.rect(a-2,b-7,4,4,'c69975');p.rect(a-3,b-3,6,6,coat);p.rect(a-2,b+3,2,4,'29343a');p.rect(a+1,b+3,2,4,'29343a')
    return p
def update():
    images={}
    ground=pitch();ground.save(SRC/'pitch-default-000.png')
    images['Pitch','Default',0]=ground
    images['Ghost','Default',0]=footballer(0,4*POSES)
    images['Ghost','Default',0].save(SRC/'ghost-default-000.png')
    # Existing export data locates each original sprite in its native atlas.
    # Paste the new frames into exactly the same rectangle; leave pickup/ring/ball
    # art and other runtime data alone.
    data=json.loads((WEB/'data.json').read_text());build_directional_atlas(data);objects=data['project'][3];sheets={}
    for obj in objects:
        for animation in obj[7] or []:
            for i,frame in enumerate(animation[7]):
                image=images.get((obj[0],animation[0],i))
                if image is None:continue
                path=WEB/frame[0];x,y,w,h,rot=frame[2:7]
                assert (w,h)==(image.w,image.h) and not rot,(obj[0],animation[0],frame)
                if path not in sheets:sheets[path]=read_png(path)
                sw,sh,pixels=sheets[path]
                assert x+w<=sw and y+h<=sh
                for row in range(h):
                    start=((y+row)*sw+x)*4
                    pixels[start:start+w*4]=image.data[row*w*4:(row+1)*w*4]
    for path,(w,h,pixels) in sheets.items():path.write_bytes(png(w,h,pixels))
    for obj in objects:
        for animation in obj[7] or []:
            for frame in animation[7]:
                path=WEB/frame[0]
                if path in sheets:frame[1]=path.stat().st_size
    (WEB/'data.json').write_text(json.dumps(data,separators=(',',':')))
    print('Repainted original footballers and recreation-ground pitch; native atlas rectangles retained.')
if __name__=='__main__':update()
