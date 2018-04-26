### Notes

Encoding png output files to video:
```
ffmpeg -framerate 10 -pattern_type glob -i "(prefix)*.png" video.mp4
```
