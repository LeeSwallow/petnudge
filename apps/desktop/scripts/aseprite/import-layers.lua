-- Builds a layered .aseprite from one PNG per layer (same canvas size).
-- usage: aseprite -b --script-param dir=<pngs> --script-param out=<file.aseprite>
--          --script-param order=body/leg.L,face/eye.L.open,... --script-param visible=leg.L,eye.L.open
--          --script import-layers.lua
-- `order` is back to front; a "<group>/" prefix puts the layer in that group
-- (groups are created in order of first use). The PNG is <dir>/<name>.png.
local dir, out = app.params["dir"], app.params["out"]
local function list(s)
  local t = {}
  for n in string.gmatch(s or "", "[^,]+") do t[#t + 1] = n end
  return t
end
local entries, shown = list(app.params["order"]), {}
for _, n in ipairs(list(app.params["visible"])) do shown[n] = true end

local function split(entry)
  local group, name = string.match(entry, "^([^/]+)/(.+)$")
  return group, name or entry
end

local _, firstName = split(entries[1])
local first = Image{ fromFile = dir .. "/" .. firstName .. ".png" }
local sprite = Sprite(first.width, first.height, ColorMode.RGB)
local placeholder = sprite.layers[1]
local groups = {}
for _, entry in ipairs(entries) do
  local group, name = split(entry)
  local layer = sprite:newLayer()
  layer.name = name
  sprite:newCel(layer, 1, Image{ fromFile = dir .. "/" .. name .. ".png" }, Point(0, 0))
  layer.isVisible = shown[name] == true
  if group then
    if not groups[group] then
      groups[group] = sprite:newGroup()
      groups[group].name = group
      groups[group].stackIndex = layer.stackIndex
    end
    layer.parent = groups[group]
  end
end
sprite:deleteLayer(placeholder)
sprite:saveAs(out)
