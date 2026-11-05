import { InvalidMetadataError, UnsupportedError } from "../errors.js";
import type { Chunk, DataType } from "../metadata.js";

type JPEGMetadata = {
	dataType: DataType;
	shape: number[];
};

export class JPEGCodec {
	kind = "array_to_bytes";
	#shape: number[];

	constructor(_configuration: unknown, meta: JPEGMetadata) {
		if (meta.dataType !== "uint8") {
			throw new InvalidMetadataError(
				`JPEG codec only supports uint8 data, got ${meta.dataType}`,
			);
		}
		if (
			meta.shape.length !== 3 ||
			meta.shape[0] !== 3 ||
			meta.shape[1] < 1 ||
			meta.shape[2] < 1
		) {
			throw new InvalidMetadataError(
				"JPEG codec expects a chunk with shape [3, height, width]",
			);
		}
		this.#shape = meta.shape;
	}

	static fromConfig(configuration: unknown, meta: JPEGMetadata): JPEGCodec {
		return new JPEGCodec(configuration, meta);
	}

	encode = (_chunk: Chunk<"uint8">): never => {
		throw new UnsupportedError("imagecodecs_jpeg encode");
	};

	async decode(bytes: Uint8Array): Promise<Chunk<"uint8">> {
		const { decode } = await import("@jsquash/jpeg");
		const input = new ArrayBuffer(bytes.byteLength);
		new Uint8Array(input).set(bytes);
		const image = await decode(input, { preserveOrientation: false });
		const [, height, width] = this.#shape;

		if (image.width !== width || image.height !== height) {
			throw new Error(
				`JPEG dimensions ${image.width}x${image.height} do not match chunk dimensions ${width}x${height}`,
			);
		}

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
