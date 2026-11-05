import { beforeEach, describe, expect, it, vi } from "vitest";
import { JPEGCodec } from "../src/codecs/jpeg.js";
import { createCodecPipeline } from "../src/codecs.js";
import { InvalidMetadataError, UnsupportedError } from "../src/errors.js";

const { decode } = vi.hoisted(() => ({ decode: vi.fn() }));

vi.mock("@jsquash/jpeg", () => ({ decode }));

describe("JPEG codec", () => {
	beforeEach(() => {
		decode.mockReset();
	});

	it("returns RGB samples with the shape and strides expected by transpose", async () => {
		decode.mockResolvedValue({
			width: 2,
			height: 1,
			data: new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255]),
		});
		const pipeline = createCodecPipeline({
			dataType: "uint8",
			shape: [3, 1, 2],
			codecs: [
				{ name: "transpose", configuration: { order: [1, 2, 0] } },
				{ name: "imagecodecs_jpeg", configuration: {} },
			],
			fillValue: 0,
		});

		const chunk = await pipeline.decode(new Uint8Array([1, 2, 3]));

		expect(decode).toHaveBeenCalledWith(expect.any(ArrayBuffer), {
			preserveOrientation: false,
		});
		expect(chunk.data).toEqual(new Uint8Array([10, 20, 30, 40, 50, 60]));
		expect(chunk.shape).toEqual([3, 1, 2]);
		expect(chunk.stride).toEqual([1, 6, 3]);
	});

	it("accepts RGB output without an alpha channel", async () => {
		decode.mockResolvedValue({
			width: 1,
			height: 1,
			data: new Uint8ClampedArray([10, 20, 30]),
		});
		const codec = JPEGCodec.fromConfig(
			{},
			{
				dataType: "uint8",
				shape: [3, 1, 1],
			},
		);

		await expect(codec.decode(new Uint8Array([1]))).resolves.toMatchObject({
			data: new Uint8Array([10, 20, 30]),
			shape: [3, 1, 1],
			stride: [1, 3, 3],
		});
	});

	it("rejects unsupported array metadata", () => {
		expect(
			() =>
				new JPEGCodec(
					{},
					{
						dataType: "uint16",
						shape: [3, 1, 1],
					},
				),
		).toThrow(InvalidMetadataError);
		expect(
			() =>
				new JPEGCodec(
					{},
					{
						dataType: "uint8",
						shape: [1, 1, 1],
					},
				),
		).toThrow(InvalidMetadataError);
	});

	it("rejects decoded dimensions that differ from the chunk", async () => {
		decode.mockResolvedValue({
			width: 2,
			height: 1,
			data: new Uint8ClampedArray(2 * 1 * 4),
		});
		const codec = JPEGCodec.fromConfig(
			{},
			{
				dataType: "uint8",
				shape: [3, 1, 1],
			},
		);

		await expect(codec.decode(new Uint8Array([1]))).rejects.toThrow(
			/JPEG dimensions 2x1 do not match chunk dimensions 1x1/,
		);
	});

	it("rejects decoded sample counts that are not RGB or RGBA", async () => {
		decode.mockResolvedValue({
			width: 1,
			height: 1,
			data: new Uint8ClampedArray([10, 20]),
		});
		const codec = JPEGCodec.fromConfig(
			{},
			{
				dataType: "uint8",
				shape: [3, 1, 1],
			},
		);

		await expect(codec.decode(new Uint8Array([1]))).rejects.toThrow(
			/JPEG decoder returned 2 samples for a 1x1 RGB chunk/,
		);
	});

	it("does not support encoding", () => {
		const codec = JPEGCodec.fromConfig(
			{},
			{
				dataType: "uint8",
				shape: [3, 1, 1],
			},
		);

		expect(() =>
			codec.encode({
				data: new Uint8Array(3),
				shape: [3, 1, 1],
				stride: [1, 3, 3],
			}),
		).toThrow(UnsupportedError);
	});
});
