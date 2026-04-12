import os
import csv
import ezdxf


def create_square_bedroom(side=5.0, origin=(0, 0), filename=None):
	"""Create a simple square bedroom DXF and save it to `filename`.

	- `side`: length of each side (units are arbitrary)
	- `origin`: (x,y) lower-left corner
	- `filename`: path to save the DXF; if None, defaults to `data/asset/bedroom_{side}x{side}.dxf`
	Returns the saved filename.
	"""
	if filename is None:
		filename = os.path.join("data", "asset", f"bedroom_{int(side)}x{int(side)}.dxf")

	# ensure directory exists
	os.makedirs(os.path.dirname(filename), exist_ok=True)

	doc = ezdxf.new("R2010")
	msp = doc.modelspace()

	x0, y0 = origin
	pts = [
		(x0, y0),
		(x0 + side, y0),
		(x0 + side, y0 + side),
		(x0, y0 + side),
		(x0, y0),
	]

	# outer walls as a closed lwpolyline
	msp.add_lwpolyline(pts, close=True)

	# add a small text showing dimensions above the square
	cx = x0 + side / 2
	cy = y0 + side + 0.25
	txt = msp.add_text(f"{side} x {side}", dxfattribs={"height": 0.25})
	# set insertion point directly (some ezdxf versions don't provide set_pos)
	txt.dxf.insert = (cx, cy)

	doc.saveas(filename)
	return filename


def create_rectangle_dxf(width, height, origin=(0, 0), filename=None, label=None, label_offset=0.25):
	"""Create a rectangle DXF (generic) and save it to `filename`.

	- `width`, `height`: dimensions
	- `origin`: (x,y) lower-left corner
	- `filename`: path to save the DXF; if None a name will be generated
	- `label`: optional text label to add above the rectangle
	Returns saved filename.
	"""
	if filename is None:
		# default name
		w = int(width) if float(width).is_integer() else width
		h = int(height) if float(height).is_integer() else height
		filename = os.path.join("data", "asset", f"rect_{w}x{h}.dxf")

	os.makedirs(os.path.dirname(filename), exist_ok=True)

	doc = ezdxf.new("R2010")
	msp = doc.modelspace()

	x0, y0 = origin
	pts = [
		(x0, y0),
		(x0 + width, y0),
		(x0 + width, y0 + height),
		(x0, y0 + height),
		(x0, y0),
	]
	msp.add_lwpolyline(pts, close=True)

	if label:
		cx = x0 + width / 2
		cy = y0 + height + label_offset
		txt = msp.add_text(str(label), dxfattribs={"height": 0.25})
		try:
			txt.dxf.insert = (cx, cy)
		except Exception:
			# fallback: use set_pos if available
			try:
				txt.set_pos((cx, cy), align="CENTER")
			except Exception:
				pass

	doc.saveas(filename)
	return filename


def get_next_id(csv_path):
	if not os.path.exists(csv_path):
		return 1
	try:
		with open(csv_path, "r", newline="", encoding="utf-8") as f:
			reader = csv.DictReader(f)
			maxid = 0
			for row in reader:
				try:
					val = int(row.get("id") or 0)
				except Exception:
					val = 0
				if val > maxid:
					maxid = val
			return maxid + 1
	except Exception:
		return 1


def append_bedroom_to_csv(csv_path, dxf_path, name="Bedroom", side=5, type_="Square", position=(0, 0)):
	os.makedirs(os.path.dirname(csv_path), exist_ok=True)
	next_id = get_next_id(csv_path)

	dimensions = f"{side},{side}"
	pos = f"{position[0]},{position[1]}"

	file_exists = os.path.exists(csv_path)
	# Ensure previous file ends with a newline to avoid concatenating rows
	if file_exists:
		try:
			with open(csv_path, "rb") as fr:
				fr.seek(0, os.SEEK_END)
				if fr.tell() > 0:
					fr.seek(-1, os.SEEK_END)
					last = fr.read(1)
					needs_newline = last not in (b"\n", b"\r")
				else:
					needs_newline = False
		except Exception:
			needs_newline = False
	else:
		needs_newline = False

	with open(csv_path, "a", newline="", encoding="utf-8") as f:
		if needs_newline:
			f.write("\n")
		writer = csv.writer(f)
		if not file_exists:
			writer.writerow(["id", "name", "type", "dimensions", "position", "path"])
		writer.writerow([next_id, name, type_, dimensions, pos, dxf_path.replace('\\', '/')])


def print_csv(csv_path):
	if not os.path.exists(csv_path):
		print(f"CSV file not found: {csv_path}")
		return
	with open(csv_path, "r", newline="", encoding="utf-8") as f:
		print(f.read())


if __name__ == "__main__":
	# configuration -- adjust as needed
	# create several elements: bedroom, bathroom, kitchen, door, window
	csv_path = os.path.join("data", "samples", "data.csv")

	# Bedroom (existing behavior)
	side = 5
	origin_bed = (10, 15)
	dxf_bed = create_square_bedroom(side=side, origin=origin_bed)
	append_bedroom_to_csv(csv_path, dxf_bed, name="Bedroom", side=side, type_="Square", position=origin_bed)

	# Bathroom
	bath_w, bath_h = 3, 3
	origin_bath = (20, 15)
	dxf_bath = create_rectangle_dxf(bath_w, bath_h, origin=origin_bath, filename=os.path.join("data", "asset", "bathroom_3x3.dxf"), label="Bathroom")
	append_bedroom_to_csv(csv_path, dxf_bath, name="Bathroom", side=bath_w, type_="Rectangle", position=origin_bath)

	# Kitchen
	kit_w, kit_h = 4, 4
	origin_kit = (25, 15)
	dxf_kit = create_rectangle_dxf(kit_w, kit_h, origin=origin_kit, filename=os.path.join("data", "asset", "kitchen_4x4.dxf"), label="Kitchen")
	append_bedroom_to_csv(csv_path, dxf_kit, name="Kitchen", side=kit_w, type_="Rectangle", position=origin_kit)

	# Door (represented as thin rectangle)
	door_w, door_h = 1.0, 0.2
	origin_door = (30, 15)
	dxf_door = create_rectangle_dxf(door_w, door_h, origin=origin_door, filename=os.path.join("data", "asset", "door_1x0.2.dxf"), label="Door")
	append_bedroom_to_csv(csv_path, dxf_door, name="Door", side=door_w, type_="Door", position=origin_door)

	# Window (represented as thin rectangle)
	win_w, win_h = 1.5, 0.15
	origin_win = (32, 15)
	dxf_win = create_rectangle_dxf(win_w, win_h, origin=origin_win, filename=os.path.join("data", "asset", "window_1.5x0.15.dxf"), label="Window")
	append_bedroom_to_csv(csv_path, dxf_win, name="Window", side=win_w, type_="Window", position=origin_win)

	print("Created DXFs:")
	print(dxf_bed)
	print(dxf_bath)
	print(dxf_kit)
	print(dxf_door)
	print(dxf_win)
	print("Updated CSV:")
	print_csv(csv_path)

