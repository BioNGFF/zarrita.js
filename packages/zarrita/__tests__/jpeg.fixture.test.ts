import * as fs from "node:fs/promises";
import { createRequire } from "node:module";
import * as path from "node:path";
import * as url from "node:url";
import { init as init_jpeg_decoder } from "@jsquash/jpeg/decode.js";
import { describe, expect, it } from "vitest";

import { create_codec_pipeline } from "../src/codecs.js";
import type { ArrayMetadata } from "../src/metadata.js";

describe("JPEG codec interoperability fixture", () => {
	async function initialize_decoder() {
		const require = createRequire(import.meta.url);
		const decoder_path = require.resolve(
			"@jsquash/jpeg/codec/dec/mozjpeg_dec.js",
		);
		const wasm = await fs.readFile(decoder_path.replace(/\.js$/, ".wasm"));
		await init_jpeg_decoder(await WebAssembly.compile(wasm));
	}

	it("decodes a grayscale Zarr array written by zarr-ext-jpeg", async () => {
		const fixture_root = path.resolve(
			path.dirname(url.fileURLToPath(import.meta.url)),
			"../../../fixtures/codecs/jpeg",
		);
		const store_path = path.join(fixture_root, "grayscale.zarr");
		const metadata = JSON.parse(
			await fs.readFile(path.join(store_path, "zarr.json"), "utf8"),
		) as ArrayMetadata<"uint8">;
		const encoded = new Uint8Array(
			await fs.readFile(path.join(store_path, "c", "0", "0")),
		);
		await initialize_decoder();
		const expected = JSON.parse(
			await fs.readFile(path.join(fixture_root, "grayscale.json"), "utf8"),
		) as { shape: number[]; dtype: string; data: number[][] };

		expect(metadata.shape).toEqual(expected.shape);
		expect(metadata.data_type).toBe(expected.dtype);
		expect(metadata.codecs).toEqual([
			{
				name: "jpeg",
				configuration: {
					quality: 95,
					encoded_color_space: "grayscale",
				},
			},
		]);

		const chunk = await create_codec_pipeline(metadata).decode(encoded);
		const source = expected.data.flat();
		const errors = source.map((value, i) => Math.abs(value - chunk.data[i]));

		expect(chunk.shape).toEqual(expected.shape);
		expect(chunk.stride).toEqual([expected.shape[1], 1]);
		expect(chunk.data).toHaveLength(source.length);
		expect(Math.max(...errors)).toBeLessThanOrEqual(20);
		expect(
			errors.reduce((sum, error) => sum + error, 0) / errors.length,
		).toBeLessThanOrEqual(5);
	});

	it("decodes a YCbCr Zarr array written by zarr-ext-jpeg", async () => {
		const fixture_root = path.resolve(
			path.dirname(url.fileURLToPath(import.meta.url)),
			"../../../fixtures/codecs/jpeg",
		);
		const store_path = path.join(fixture_root, "ycbcr.zarr");
		const metadata = JSON.parse(
			await fs.readFile(path.join(store_path, "zarr.json"), "utf8"),
		) as ArrayMetadata<"uint8">;
		const encoded = new Uint8Array(
			await fs.readFile(path.join(store_path, "c", "0", "0", "0")),
		);
		await initialize_decoder();
		const expected = JSON.parse(
			await fs.readFile(path.join(fixture_root, "ycbcr.json"), "utf8"),
		) as { shape: number[]; dtype: string; data: number[][][] };

		expect(metadata.shape).toEqual(expected.shape);
		expect(metadata.data_type).toBe(expected.dtype);
		expect(metadata.codecs).toEqual([
			{ name: "transpose", configuration: { order: [1, 2, 0] } },
			{
				name: "jpeg",
				configuration: {
					quality: 95,
					encoded_color_space: "ycbcr",
					subsampling: [
						[2, 2],
						[1, 1],
						[1, 1],
					],
				},
			},
		]);

		const chunk = await create_codec_pipeline(metadata).decode(encoded);
		const [channels, height, width] = expected.shape;
		const errors: number[] = [];
		for (let channel = 0; channel < channels; channel++) {
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const source = expected.data[channel][y][x];
					const decoded =
						chunk.data[y * width * channels + x * channels + channel];
					errors.push(Math.abs(source - decoded));
				}
			}
		}

		expect(chunk.shape).toEqual(expected.shape);
		expect(chunk.stride).toEqual([1, width * channels, channels]);
		expect(errors).toHaveLength(channels * height * width);
		expect(Math.max(...errors)).toBeLessThanOrEqual(32);
		expect(
			errors.reduce((sum, error) => sum + error, 0) / errors.length,
		).toBeLessThanOrEqual(8);
	});

	it("decodes an RGB Zarr array written by zarr-ext-jpeg", async () => {
		const fixture_root = path.resolve(
			path.dirname(url.fileURLToPath(import.meta.url)),
			"../../../fixtures/codecs/jpeg",
		);
		const store_path = path.join(fixture_root, "rgb.zarr");
		const metadata = JSON.parse(
			await fs.readFile(path.join(store_path, "zarr.json"), "utf8"),
		) as ArrayMetadata<"uint8">;
		const encoded = new Uint8Array(
			await fs.readFile(path.join(store_path, "c", "0", "0", "0")),
		);
		await initialize_decoder();
		const expected = JSON.parse(
			await fs.readFile(path.join(fixture_root, "rgb.json"), "utf8"),
		) as { shape: number[]; dtype: string; data: number[][][] };

		expect(metadata.shape).toEqual(expected.shape);
		expect(metadata.data_type).toBe(expected.dtype);
		expect(metadata.codecs).toEqual([
			{ name: "transpose", configuration: { order: [1, 2, 0] } },
			{
				name: "jpeg",
				configuration: {
					quality: 95,
					encoded_color_space: "rgb",
				},
			},
		]);

		const chunk = await create_codec_pipeline(metadata).decode(encoded);
		const [channels, height, width] = expected.shape;
		const errors: number[] = [];
		for (let channel = 0; channel < channels; channel++) {
			for (let y = 0; y < height; y++) {
				for (let x = 0; x < width; x++) {
					const source = expected.data[channel][y][x];
					const decoded =
						chunk.data[y * width * channels + x * channels + channel];
					errors.push(Math.abs(source - decoded));
				}
			}
		}

		expect(chunk.shape).toEqual(expected.shape);
		expect(chunk.stride).toEqual([1, width * channels, channels]);
		expect(errors).toHaveLength(channels * height * width);
		expect(Math.max(...errors)).toBeLessThanOrEqual(32);
		expect(
			errors.reduce((sum, error) => sum + error, 0) / errors.length,
		).toBeLessThanOrEqual(8);
	});
});
