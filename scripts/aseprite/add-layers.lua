-- Adds PNG layers to an existing .aseprite, in place: a layer with the same
-- name gets its pixels replaced, a new one is created hidden at the top. Other
-- layers (and hand edits) are untouched.
-- usage: aseprite -b --script-param file=<x.aseprite> --script-param dir=<pngs>
--          --script-param names=face.pout,body#stretch [--script-param group=face]
--          --script add-layers.lua
-- With `group`, new layers go into that group (when it exists).
local sprite = app.open(app.params["file"])
local dir = app.params["dir"]
local added, replaced = 0, 0
local group
local function find(list, name)
  for _, l in ipairs(list) do
    if l.name == name then return l end
    if l.isGroup then local hit = find(l.layers, name) if hit then return hit end end
  end
end
if app.params["group"] then group = find(sprite.layers, app.params["group"]) end
for name in string.gmatch(app.params["names"], "[^,]+") do
  local image = Image{ fromFile = dir .. "/" .. name .. ".png" }
  local layer
  layer = find(sprite.layers, name)
  if layer and layer.isGroup then layer = nil end
  if layer then
    replaced = replaced + 1
    local cel = layer:cel(1)
    if cel then sprite:deleteCel(cel) end
  else
    added = added + 1
    layer = sprite:newLayer()
    layer.name = name
    layer.isVisible = false
    if group and group.isGroup then layer.parent = group end
  end
  sprite:newCel(layer, 1, image, Point(0, 0))
end
sprite:saveAs(app.params["file"])
print("added " .. added .. ", replaced " .. replaced)
