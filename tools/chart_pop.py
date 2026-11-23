import sys,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import render as R
from PIL import ImageDraw
out=sys.argv[1]
img=R.bg_grid_glow((R.W-100,200),560,0.30); d=ImageDraw.Draw(img)
d.text((R.M,190),"POPULATION: 2025 vs 2100",font=R.anton(54),fill=R.RED,anchor="ls")
d.rectangle([R.M,206,R.M+70,212],fill=R.RED)
d.text((R.M,262),"UN medium projection, millions of people",font=R.inter(28,500),fill=R.GRAY,anchor="ls")
rows=[("INDIA",1464,1500,"~1,500"),("CHINA",1416,633,"~633"),("USA",347,421,"~421")]
mx=1500;bw=R.W-2*R.M;y=350
for name,a,b,bl in rows:
    d.text((R.M,y),name,font=R.anton(58),fill=R.WHITE,anchor="ls")
    for lab,v,col,lbl,yy in (("2025",a,R.MUTED,f"{a:,}",y+30),("2100",b,R.RED,bl,y+30+70)):
        w=max(8,int(v/mx*(bw-260)))
        d.text((R.M,yy+38),lab,font=R.inter(24,700),fill=R.GRAY,anchor="ls")
        d.rounded_rectangle([R.M+90,yy,R.M+90+w,yy+48],radius=6,fill=col)
        d.text((R.M+90+w+14,yy+38),lbl,font=R.inter(28,700),fill=R.WHITE,anchor="ls")
    y+=300
d.text((R.M,R.H-R.M-56-16),"Source: UN DESA, World Population Prospects 2024 (via INED)",font=R.inter(22,400),fill=(100,100,112),anchor="ls")
R.footer(img,"NOV 23, 2026","2/5")
img.save(out,quality=95,subsampling=0)
