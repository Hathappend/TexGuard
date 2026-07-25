from PIL import Image
import os
import glob

files = glob.glob(r"c:\KULIAH\SKRIPSI\skripsi\project\DSpam\banner*.png")
target_size = (1280, 800)

count = 0
for f in files:
    if "_1280x800" in f:
        continue
        
    try:
        img = Image.open(f).convert("RGBA")
        
        # Determine background color by sampling the top-left pixel
        # Assuming the user created a solid background
        bg_color = img.getpixel((0, 0))
        
        # Calculate aspect ratio
        ratio = min(target_size[0] / img.width, target_size[1] / img.height)
        new_size = (int(img.width * ratio), int(img.height * ratio))
        
        # Resize image cleanly
        img = img.resize(new_size, Image.Resampling.LANCZOS)
        
        # Create final 1280x800 canvas
        new_img = Image.new("RGBA", target_size, bg_color)
        
        # Calculate position to center the image
        x = (target_size[0] - img.width) // 2
        y = (target_size[1] - img.height) // 2
        
        # Paste image onto center of canvas
        new_img.paste(img, (x, y), img)
        
        # Google requires no alpha channel for web store
        new_img = new_img.convert("RGB")
        
        # Save
        out_name = f.replace(".png", "_1280x800.png")
        new_img.save(out_name)
        print(f"Resized: {os.path.basename(out_name)}")
        count += 1
    except Exception as e:
        print(f"Failed on {f}: {e}")

print(f"Successfully resized {count} banners.")
