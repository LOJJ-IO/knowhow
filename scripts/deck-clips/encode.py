import json, subprocess, sys, os
d = sys.argv[1]; out = sys.argv[2]
fr = json.load(open(f"{d}/frames.json"))
# Concat list with each frame held until the next one arrives.
with open(f"{d}/list.txt", "w") as f:
    for a, b in zip(fr, fr[1:]):
        if a["file"] is None: continue
        f.write(f"file '{os.path.abspath(a['file'])}'\nduration {max(0.001, b['t'] - a['t']):.4f}\n")
    last = [x for x in fr if x["file"]][-1]
    f.write(f"file '{os.path.abspath(last['file'])}'\n")
vf = "fps=30,scale=1920:1080:flags=lanczos,format=yuv420p"
subprocess.run(["ffmpeg","-v","error","-y","-f","concat","-safe","0","-i",f"{d}/list.txt","-vf",vf,
  "-c:v","libx264","-preset","slow","-crf","20","-movflags","+faststart","-an",out+".mp4"], check=True)
subprocess.run(["ffmpeg","-v","error","-y","-i",out+".mp4","-c:v","libvpx-vp9","-b:v","0","-crf","34","-row-mt","1","-an",out+".webm"], check=True)
