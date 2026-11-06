import type { Chunk, DataType } from "../metadata.js";
import { assert } from "../util.js";

type JPEGMetadata = {
	data_type: DataType;
	shape: number[];
};

export class JPEGCodec {
	kind = "array_to_bytes";
	#shape: number[];

	constructor(_configuration: unknown, meta: JPEGMetadata) {
		assert(
			meta.data_type === "uint8",
			`JPEG codec only supports uint8 data, got ${meta.data_type}`,
		);
		assert(
			meta.shape.length === 3 &&
				meta.shape[0] === 3 &&
				meta.shape[1] > 0 &&
				meta.shape[2] > 0,
			"JPEG codec expects a chunk with shape [3, height, width]",
		);
		this.#shape = meta.shape.slice();
	}

	static fromConfig(configuration: unknown, meta: JPEGMetadata): JPEGCodec {
		return new JPEGCodec(configuration, meta);
	}

	//Do we need to extend to different dtypes?
	encode(_chunk: Chunk<"uint8">): Uint8Array {
		throw new Error("JPEG encoding is not implemented.");
	}

	async decode(bytes: Uint8Array): Promise<Chunk<"uint8">> {
		const { decode } = await import("@jsquash/jpeg");
		//Is taking the input Uint8Array, pre-allocating an ArrayBuffer, and then creating a Uint8Array from that ArrayBuffer not circular?
		const input = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(input).set(bytes);
		const image = await decode(input, { preserveOrientation: false });

		//Shape as taken from zarr chunk dimensions
		const [, height, width] = this.#shape;

		//Not sure if we're mixing chunk definitions here? A zarr chunk is the whole file, but we are only decoding 1 pixel of it at a time
		//Need to understand this
		if (image.width !== width || image.height !== height) {
			throw new Error(
				`JPEG dimensions ${image.width}x${image.height} do not match chunk dimensions ${width}x${height}`,
			);
		}

		//What is going on here?
		const pixels = width * height;
		let data: Uint8Array;
		if (image.data.length === pixels * 4) {
			data = new Uint8Array(pixels * 3);
			for (let pixel = 0; pixel < pixels; pixel++) {
				data[pixel * 3] = image.data[pixel * 4];
				data[pixel * 3 + 1] = image.data[pixel * 4 + 1];
				data[pixel * 3 + 2] = image.data[pixel * 4 + 2];
			}
		} else if (image.data.length === pixels * 3) {
			data = new Uint8Array(image.data);
		} else {
			throw new Error(
				`JPEG decoder returned ${image.data.length} samples for a ${width}x${height} RGB chunk`,
			);
		}

		return {
			data,
			shape: this.#shape,
			stride: [1, width * 3, 3],
		};
	}
}
