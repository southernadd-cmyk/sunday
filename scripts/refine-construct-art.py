#!/usr/bin/env python3
"""Original low-resolution football art. Update native source and export atlas
rectangles in place, preserving Construct's dimensions, frame IDs and UVs.
Only RGBA, non-interlaced PNGs are supported, matching the existing export."""
from pathlib import Path
import json, random, struct, zlib, math

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
def footballer(team,frame):
    # Crisp three-quarter overhead silhouette, broad shoulders, shorts, socks,
    # alternating stride, dark outline and small highlights. No gradients.
    p=Canvas(16,16);r=p.rect
    kits=[('e74b3c','9c2c2a','ff8b68'),('4173cc','25458a','80b1f2'),('e4b748','96732a','ffe392'),('333d50','202535','65748a')]
    light,shade,highlight=kits[team];skin=['e5ac79','c88755','efc494','be895f'][team];hair=['57382a','382b26','735239','302722'][team]
    p.ellipse(8,13,6,2,(12,32,22,100))
    r(5,1,6,5,'27262b');r(6,1,4,1,hair);r(5,2,6,3,hair);r(6,4,4,2,skin);r(10,3,1,2,skin)
    r(4,6,8,5,'262a2d');r(5,6,6,4,light);r(5,7,1,3,highlight);r(10,7,1,3,shade);r(7,6,2,1,highlight)
    r(3,7+frame,2,3,shade);r(11,8-frame,2,3,shade);r(3,9+frame,2,2,skin);r(11,10-frame,2,2,skin)
    shorts='e9e5ce' if team==0 else 'd1d9df' if team==1 else '303943'
    r(5,10,6,3,'252a2c');r(5,10,6,2,shorts);r(8,10,1,2,'93958c')
    r(5,12,2,2+frame,light);r(9,12,2,3-frame,light);r(5,12,2,1,highlight);r(9,12,2,1,highlight)
    r(4,14+frame,3,1,'20282b');r(9,15-frame,3,1,'20282b')
    return p
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
        box(-36,-52+i*104/12,72,104/12,('43874b','397d43')[i%2])
    for _ in range(7800):
        x=rng.randrange(48,480);y=rng.randrange(18,642)
        p.pixel(x,y,rng.choice(['498e4d','398047','528f4d','36763f']))
    # Goal mouths and centre circle wear, stippled to keep pitch markings clear.
    for z in (-44,44):
        cx,cy=xy(0,z)
        for _ in range(850):
            x=rng.randrange(cx-48,cx+49);y=rng.randrange(cy-16,cy+17)
            if ((x-cx)/48)**2+((y-cy)/16)**2<rng.random():
                p.pixel(x,y,rng.choice(['77764d','7b8151','60834b']))
    outline(-34,-47,68,94);line(-34,0,34,0)
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
    for team,name in enumerate(('Home','Away','Keeper','Official')):
        for f in range(2):
            a=footballer(team,f);a.save(SRC/f'footballer-{name.lower()}-{f:03}.png');images['Footballer',name,f]=a
    images['Ghost','Default',0]=images['Footballer','Home',0]
    images['Ghost','Default',0].save(SRC/'ghost-default-000.png')
    # Existing export data locates each original sprite in its native atlas.
    # Paste the new frames into exactly the same rectangle; leave pickup/ring/ball
    # art and other runtime data alone.
    data=json.loads((WEB/'data.json').read_text());objects=data['project'][3];sheets={}
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
