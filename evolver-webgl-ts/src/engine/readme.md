python-fu script to spit out a brush definition:

```
def b():
    _, left, top, right, bottom = pdb.gimp_selection_bounds(image)
    brush = json.dumps({"left": left, "top": top, "right": right, "bottom": bottom, "tag": tag}, sort_keys=True)
    print(brush)
    copy(brush)
```
