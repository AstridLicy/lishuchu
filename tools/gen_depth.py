#!/usr/bin/env python3
"""
从平面画作生成深度图（depth map）。
使用开源模型 Depth Anything V2（本地运行，不联网调用，仅首次下载权重）。

用法：
    python tools/gen_depth.py assets/painting/painting.png assets/depth/painting_depth.png
"""
import sys
from PIL import Image, ImageFilter
import numpy as np


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "assets/painting/painting.png"
    dst = sys.argv[2] if len(sys.argv) > 2 else "assets/depth/painting_depth.png"

    print(f"[1/4] 加载图片：{src}")
    image = Image.open(src).convert("RGB")

    print("[2/4] 加载 Depth Anything V2 模型（首次会下载权重，请稍候）……")
    from transformers import pipeline
    import torch

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    print(f"      使用设备：{device}")
    pipe = pipeline(
        task="depth-estimation",
        model="depth-anything/Depth-Anything-V2-Base-hf",
        device=device,
    )

    print("[3/4] 推理中……")
    result = pipe(image)
    depth = result["depth"]  # PIL Image, 近大远小（值越大越近）

    print("[4/4] 归一化并平滑，保存深度图")
    arr = np.array(depth).astype(np.float32)
    arr = (arr - arr.min()) / (arr.max() - arr.min() + 1e-8)
    arr = (arr * 255.0).astype(np.uint8)
    out = Image.fromarray(arr, mode="L")
    # 轻微高斯模糊，减少 8-bit 量化造成的台阶感，使 3D 起伏更顺滑
    out = out.filter(ImageFilter.GaussianBlur(radius=1.2))
    out = out.resize(image.size)
    out.save(dst)
    print(f"完成 ✅ 已保存：{dst}  尺寸：{out.size}")


if __name__ == "__main__":
    main()
