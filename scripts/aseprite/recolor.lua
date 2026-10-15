-- Swaps exact colours in every cel of an .aseprite, in place (keeps hand edits).
-- usage: aseprite -b --script-param file=<x.aseprite> --script-param map=fda9ad:fcc9c9,...
--          [--script-param layers=body,face.smile] --script recolor.lua
local file = app.params["file"]
local only = {}
for n in string.gmatch(app.params["layers"] or "", "[^,]+") do only[n] = true end
local filter = next(only) ~= nil

local map = {}
for from, to in string.gmatch(app.params["map"], "#?(%x%x%x%x%x%x):#?(%x%x%x%x%x%x)") do
  local f, t = tonumber(from, 16), tonumber(to, 16)
  map[app.pixelColor.rgba(f >> 16, (f >> 8) & 255, f & 255, 255)] =
    app.pixelColor.rgba(t >> 16, (t >> 8) & 255, t & 255, 255)
end

local sprite = app.open(file)
local changed = 0
for _, cel in ipairs(sprite.cels) do
  if not filter or only[cel.layer.name] then
    local image = cel.image:clone()
    for it in image:pixels() do
      local to = map[it()]
      if to then
        it(to)
        changed = changed + 1
      end
    end
    cel.image = image
  end
end
sprite:saveAs(file)
print("recolored " .. changed .. " pixels")
