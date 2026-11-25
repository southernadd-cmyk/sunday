const C3 = self.C3;
self.C3_GetObjectRefTable = function () {
	return [
		C3.Plugins.Sprite,
		C3.Plugins.DrawingCanvas,
		C3.Plugins.Text
	];
};
self.C3_JsPropNameTable = [
	{Pitch: 0},
	{Footballer: 0},
	{Ball: 0},
	{StrikerRing: 0},
	{Ghost: 0},
	{Pickup: 0},
	{Plans: 0},
	{HudCanvas: 0},
	{Label: 0}
];

self.InstanceType = {
	Pitch: class extends self.ISpriteInstance {},
	Footballer: class extends self.ISpriteInstance {},
	Ball: class extends self.ISpriteInstance {},
	StrikerRing: class extends self.ISpriteInstance {},
	Ghost: class extends self.ISpriteInstance {},
	Pickup: class extends self.ISpriteInstance {},
	Plans: class extends self.IDrawingCanvasInstance {},
	HudCanvas: class extends self.IDrawingCanvasInstance {},
	Label: class extends self.ITextInstance {}
}