import type { Chunk, DataType } from "../metadata.js";
import { assert, get_strides } from "../util.js";

type JPEGMetadata = {
	data_type: DataType;
	shape: number[];
};

function is_record(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export class JPEGCodec {
	kind = "array_to_bytes";
	#shape: number[];
	#channels: 1 | 3;

	constructor(configuration: unknown, meta: JPEGMetadata) {
		assert(
			meta.data_type === "uint8",
			`JPEG codec only supports uint8 data, got ${meta.data_type}`,
		);

		const grayscale =
			is_record(configuration) &&
			configuration.encoded_color_space === "grayscale";

	
		this.#channels = grayscale ? 1 : 3;
		this.#shape = meta.shape.slice();
	}

	static fromConfig(configuration: unknown, meta: JPEGMetadata): JPEGCodec {
		return new JPEGCodec(configuration, meta);
	}

	encode(_chunk: Chunk<"uint8">): Uint8Array {
		throw new Error("JPEG encoding is not implemented.");
	}

	async decode(bytes: Uint8Array): Promise<Chunk<"uint8">> {
		const { decode } = await import("@jsquash/jpeg");
		const input = new ArrayBuffer(bytes.byteLength);

		//Copy bytes into ArrayBuffer
		new Uint8Array(input).set(bytes);
		const image = await decode(input, { preserveOrientation: false });

		const height = this.#channels === 1 ? this.#shape[0] : this.#shape[1];
		const width = this.#channels === 1 ? this.#shape[1] : this.#shape[2];
		if (image.width !== width || image.height !== height) {
			throw new Error(
				`JPEG dimensions ${image.width}x${image.height} do not match chunk dimensions ${width}x${height}`,
			);
		}

		const pixels = width * height;
		const samples_per_pixel = image.data.length / pixels;
		if (samples_per_pixel !== 3 && samples_per_pixel !== 4) {
			throw new Error(
				`JPEG decoder returned ${image.data.length} samples for a ${width}x${height} image`,
			);
		}
		const input_channels = samples_per_pixel;
		const data = new Uint8Array(pixels * this.#channels);
		for (let pixel = 0; pixel < pixels; pixel++) {
			const input_offset = pixel * input_channels;
			const output_offset = pixel * this.#channels;
			if (this.#channels === 1) {
				const gray = image.data[input_offset];
				assert(
					gray === image.data[input_offset + 1] &&
						gray === image.data[input_offset + 2],
					"JPEG decoder returned non-grayscale pixels for a grayscale chunk",
				);
				data[pixel] = gray;
			} else {
				data[output_offset] = image.data[input_offset];
				data[output_offset + 1] = image.data[input_offset + 1];
				data[output_offset + 2] = image.data[input_offset + 2];
			}
		}

		return {
			data,
			shape: this.#shape,
			stride:
				this.#channels === 1
					? get_strides(this.#shape, "C")
					: [1, width * 3, 3],
		};
	}
}
