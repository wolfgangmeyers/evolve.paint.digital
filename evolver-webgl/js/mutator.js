function Mutator(imageWidth, imageHeight) {
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
    this.minTriangleRadius = 10.0;
    this.maxTriangleRadius = 100.0;

}

Mutator.prototype.randomizeTriangle = function(triangle) {
    triangle.x = Math.random() * this.imageWidth;
    triangle.y = Math.random() * this.imageHeight;
    triangle.color[0] = Math.random();
    triangle.color[1] = Math.random();
    triangle.color[2] = Math.random();
    triangle.color[3] = 1;
    for (var i = 0; i < 3; i++) {
        triangle.points[i].distance = Math.random() * (this.maxTriangleRadius - this.minTriangleRadius) + this.minTriangleRadius;
        triangle.points[i].angle = Math.random() * Math.PI * 2;
    }
    return triangle;
}