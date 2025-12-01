import os
import sys
from pathlib import Path
from PIL import Image

# Try to import rembg
try:
    from rembg import remove
    HAS_REMBG = True
except ImportError:
    print("rembg not found. Install it with: pip install rembg")
    HAS_REMBG = False

BASE_DIR = Path(__file__).resolve().parent.parent
ASSETS_DIR = BASE_DIR / "assets"
FINALIZED_DIR = ASSETS_DIR / "finalized"

# Theme Colors
BG_COLOR = (15, 23, 42, 255)  # #0f172a (Dark Slate Blue)

SOURCES = {
    "Option1": ASSETS_DIR / "Generated_icon_1.png",
    "Option2": ASSETS_DIR / "Generated_icon_2.png",
    "Feature": ASSETS_DIR / "feature_graphic.png",
    "Splash": ASSETS_DIR / "generated_splash.png"
}

OUTPUT_SPECS = {
    "icon_transparent": [
        ("pwa_icon_512.png", (512, 512)),
        ("pwa_icon_192.png", (192, 192)),
        ("favicon.png", (64, 64)),
        ("apple-touch-icon.png", (180, 180))
    ],
    "icon_filled": [
        ("play_store_icon.png", (512, 512)),
        ("capacitor_icon.png", (1024, 1024))
    ],
    "feature": [
        ("feature_graphic.png", (1024, 500))
    ],
    "splash": [
        ("capacitor_splash.png", (2732, 2732))
    ]
}

def clean_background(img):
    if HAS_REMBG:
        print("  Removing background with rembg...")
        return remove(img)
    else:
        print("  Warning: rembg not installed. Skipping background removal.")
        return img

def create_filled_icon(transparent_img, size, bg_color):
    # Create a solid background
    bg = Image.new("RGBA", size, bg_color)
    
    # Resize the transparent icon to fit nicely (e.g. 80% of the box)
    # This gives it some padding so it doesn't touch the edges
    padding_factor = 0.8
    target_size = (int(size[0] * padding_factor), int(size[1] * padding_factor))
    
    icon_resized = transparent_img.copy()
    icon_resized.thumbnail(target_size, Image.Resampling.LANCZOS)
    
    # Center it
    pos = (
        (size[0] - icon_resized.width) // 2,
        (size[1] - icon_resized.height) // 2
    )
    
    bg.alpha_composite(icon_resized, pos)
    return bg

def process_icon_set(source_path, output_dir):
    if not source_path.exists():
        print(f"Warning: Source file not found: {source_path}")
        return

    print(f"Processing {source_path.name}...")
    
    try:
        with Image.open(source_path) as img:
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            # Step 1: Create a clean transparent version
            # We assume the user wants to remove the background from the AI generation
            clean_img = clean_background(img)
            
            # Save the clean master for reference
            clean_img.save(output_dir / "master_transparent.png")
            
            # Step 2: Generate Transparent Icons (PWA, Favicon)
            for name, size in OUTPUT_SPECS["icon_transparent"]:
                # Resize
                final = clean_img.copy()
                final.thumbnail(size, Image.Resampling.LANCZOS)
                
                # Create a new canvas of the exact size (in case thumbnail aspect ratio differs)
                # But for icons, usually we want them centered if not square.
                # However, clean_img from rembg usually preserves aspect ratio of the object.
                # Let's center it on a transparent canvas of the target size.
                canvas = Image.new("RGBA", size, (0, 0, 0, 0))
                pos = ((size[0] - final.width) // 2, (size[1] - final.height) // 2)
                canvas.alpha_composite(final, pos)
                
                canvas.save(output_dir / name)
                print(f"  Generated: {name}")

            # Step 3: Generate Filled Icons (Play Store, Capacitor)
            for name, size in OUTPUT_SPECS["icon_filled"]:
                filled = create_filled_icon(clean_img, size, BG_COLOR)
                filled.save(output_dir / name)
                print(f"  Generated: {name}")

    except Exception as e:
        print(f"Error processing {source_path}: {e}")

def process_simple_resize(source_path, output_dir, specs):
    if not source_path.exists():
        print(f"Warning: Source file not found: {source_path}")
        return

    try:
        with Image.open(source_path) as img:
            if img.mode != 'RGBA':
                img = img.convert('RGBA')
            
            for name, size in specs:
                final_img = img.copy()
                
                # Cover resize logic
                target_ratio = size[0] / size[1]
                img_ratio = img.width / img.height
                
                if img_ratio > target_ratio:
                    new_height = size[1]
                    new_width = int(new_height * img_ratio)
                    final_img = final_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    left = (new_width - size[0]) // 2
                    final_img = final_img.crop((left, 0, left + size[0], size[1]))
                else:
                    new_width = size[0]
                    new_height = int(new_width / img_ratio)
                    final_img = final_img.resize((new_width, new_height), Image.Resampling.LANCZOS)
                    top = (new_height - size[1]) // 2
                    final_img = final_img.crop((0, top, size[0], top + size[1]))
                
                final_img.save(output_dir / name)
                print(f"  Generated: {name}")

    except Exception as e:
        print(f"Error processing {source_path}: {e}")

def main():
    FINALIZED_DIR.mkdir(parents=True, exist_ok=True)
    
    # Process Option 1
    opt1_dir = FINALIZED_DIR / "Option1"
    opt1_dir.mkdir(exist_ok=True)
    process_icon_set(SOURCES["Option1"], opt1_dir)
    
    # Process Option 2
    opt2_dir = FINALIZED_DIR / "Option2"
    opt2_dir.mkdir(exist_ok=True)
    process_icon_set(SOURCES["Option2"], opt2_dir)
    
    # Process Common Assets
    common_dir = FINALIZED_DIR / "Common"
    common_dir.mkdir(exist_ok=True)
    
    print("Processing Feature Graphic...")
    process_simple_resize(SOURCES["Feature"], common_dir, OUTPUT_SPECS["feature"])
    
    print("Processing Splash Screen...")
    process_simple_resize(SOURCES["Splash"], common_dir, OUTPUT_SPECS["splash"])
    
    print("\nDone! Assets are in assets/finalized/")

if __name__ == "__main__":
    main()
