import type { Chunk, DataType } from "../metadata.js";
import { assert, get_strides } from "../util.js";

type JPEGMetadata = {
	data_type: DataType;
	shape: number[];
};

//Zarr Conventions compliant JPEG codec
export class JPEGCodec {
	kind = "array_to_bytes";
	#shape: number[];
	#channels: 1 | 3;

	constructor(configuration: Record<string, string>, meta: JPEGMetadata) {
		assert(
			meta.data_type === "uint8",
			`JPEG codec only supports uint8 data, got ${meta.data_type}`,
		);

		const grayscale =
			configuration?.encoded_color_space === "grayscale";

		this.#channels = grayscale ? 1 : 3;
		this.#shape = meta.shape.slice();
	}

	#getDimensions(): { height: number; width: number } {
		return this.#channels === 1
			? { height: this.#shape[0], width: this.#shape[1] }
			: { height: this.#shape[1], width: this.#shape[2] };
	}

	#removeAlphaChannel(image: ImageData, pixels: number): Uint8Array {
		const copy = new Uint8ClampedArray(image.data);
		for (let pixel = 0; pixel < pixels; pixel++) {
			const input_offset = pixel * 4;
			const output_offset = pixel * 3;
			copy[output_offset] = copy[input_offset];
			copy[output_offset + 1] = copy[input_offset + 1];
			copy[output_offset + 2] = copy[input_offset + 2];
		}
		return new Uint8Array(copy.buffer, copy.byteOffset, pixels * 3);
	}

	static fromConfig(configuration: Record<string, string>, meta: JPEGMetadata): JPEGCodec {
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

		const { height, width } = this.#getDimensions();

		const pixels = width * height;

		//Always 4 for @jsquash/jpeg decoder
		const values_per_pixel = image.data.length / pixels;

		if (this.#channels === 1) {
			const data = new Uint8Array(pixels);
			//Decoder always gives RGBA, so select an arbitrary channel for grayscale images
			for (let pixel = 0; pixel < pixels; pixel++) {
				data[pixel] = image.data[pixel * values_per_pixel];
			}
			return {
				data,
				shape: this.#shape,
				stride: get_strides(this.#shape, "C"),
			};
			
		}
		const rgb_data = this.#removeAlphaChannel(image, pixels);

		return {
			data: rgb_data,
			shape: this.#shape,
			stride: get_strides(this.#shape, [1, 2, 0]),
		};
	}
}
