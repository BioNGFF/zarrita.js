# /// script
# requires-python = ">=3.12"
# dependencies = [
#     "zarr-ext-jpeg==0.3.1",
# ]
# ///

import json
import pathlib
import shutil

import numpy as np
import zarr
import zarr.storage
from zarr_ext_jpeg import JpegCodec

ROOT = pathlib.Path(__file__).parent.parent / "fixtures" / "codecs" / "jpeg"
ARRAY = ROOT / "grayscale.zarr"
YCbCr_ARRAY = ROOT / "ycbcr.zarr"
RGB_ARRAY = ROOT / "rgb.zarr"

shutil.rmtree(ARRAY, ignore_errors=True)
shutil.rmtree(YCbCr_ARRAY, ignore_errors=True)
shutil.rmtree(RGB_ARRAY, ignore_errors=True)
ROOT.mkdir(parents=True, exist_ok=True)

height, width = 16, 16
y, x = np.indices((height, width))
data = ((17 * x + 29 * y + 37 * ((x // 4 + y // 4) % 2)) % 256).astype(
    np.uint8
)

zarr.create_array(
    zarr.storage.LocalStore(ARRAY),
    data=data,
    chunks=data.shape,
    serializer=JpegCodec.builder("grayscale").quality(95).build(),
    compressors=[],
)

(ROOT / "grayscale.json").write_text(
    json.dumps({"shape": data.shape, "dtype": "uint8", "data": data.tolist()}),
    encoding="utf-8",
)

height, width = 16, 16
y, x = np.indices((height, width))
ycbcr_data = np.stack(
    [
        (9 * x + 2 * y) % 256,
        (2 * x + 11 * y) % 256,
        (5 * x + 3 * y) % 256,
    ]
).astype(np.uint8)

zarr.create_array(
    zarr.storage.LocalStore(YCbCr_ARRAY),
    data=ycbcr_data,
    chunks=ycbcr_data.shape,
    filters=[zarr.codecs.TransposeCodec(order=(1, 2, 0))],
    serializer=(
        JpegCodec.builder("ycbcr")
        .chroma_subsampling(2, 2)
        .quality(95)
        .build()
    ),
    compressors=[],
)

(ROOT / "ycbcr.json").write_text(
    json.dumps(
        {"shape": ycbcr_data.shape, "dtype": "uint8", "data": ycbcr_data.tolist()}
    ),
    encoding="utf-8",
)

height, width = 16, 16
y, x = np.indices((height, width))
rgb_data = np.stack(
    [
        (11 * x + 3 * y) % 256,
        (2 * x + 13 * y) % 256,
        (7 * x + 5 * y) % 256,
    ]
).astype(np.uint8)

zarr.create_array(
    zarr.storage.LocalStore(RGB_ARRAY),
    data=rgb_data,
    chunks=rgb_data.shape,
    filters=[zarr.codecs.TransposeCodec(order=(1, 2, 0))],
    serializer=JpegCodec.builder("rgb").quality(95).build(),
    compressors=[],
)

(ROOT / "rgb.json").write_text(
    json.dumps({"shape": rgb_data.shape, "dtype": "uint8", "data": rgb_data.tolist()}),
    encoding="utf-8",
)
