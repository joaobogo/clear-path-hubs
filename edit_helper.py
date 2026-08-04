import re, sys

def flex(text):
    """Build a regex from literal code that tolerates any indentation."""
    parts = [re.escape(line.strip()) for line in text.strip().split("\n")]
    return re.compile(r"\n\s*".join(parts))

def rw(path, pairs):
    s = open(path).read()
    for old, new in pairs:
        pat = flex(old)
        s2, n = pat.subn(lambda _m: new, s, count=1)
        if n != 1:
            print("MISS", path, old.strip().split("\n")[0][:70])
            sys.exit(1)
        s = s2
    open(path, "w").write(s)
    print("ok", path)
