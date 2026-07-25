import urllib.request
import os

base_url = "https://unpkg.com/@phosphor-icons/web@2.1.1/src"
files = [
    "/regular/style.css",
    "/regular/Phosphor.woff2",
    "/fill/style.css",
    "/fill/Phosphor-Fill.woff2"
]

os.makedirs("extension/src/assets/phosphor/regular", exist_ok=True)
os.makedirs("extension/src/assets/phosphor/fill", exist_ok=True)

print("Downloading Phosphor Icons...")
for f in files:
    url = base_url + f
    dest = "extension/src/assets/phosphor" + f
    print(f"Downloading {url} to {dest}")
    urllib.request.urlretrieve(url, dest)
print("Done!")
