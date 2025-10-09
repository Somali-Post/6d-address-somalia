'use strict';

function createSquaresBackground(element) {
    const canvas = document.createElement('canvas');
    element.prepend(canvas);
    const ctx = canvas.getContext('2d');
    let width, height, squares;

    function init() {
        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        squares = [];
        for (let i = 0; i < 50; i++) {
            squares.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 20 + 10,
                speedX: (Math.random() - 0.5) * 0.5,
                speedY: (Math.random() - 0.5) * 0.5,
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = 'rgba(153, 153, 153, 0.2)';
        squares.forEach(square => {
            square.x += square.speedX;
            square.y += square.speedY;

            if (square.x > width) square.x = 0;
            if (square.x < 0) square.x = width;
            if (square.y > height) square.y = 0;
            if (square.y < 0) square.y = height;

            ctx.strokeRect(square.x, square.y, square.size, square.size);
        });
        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', init);
    init();
    animate();
}

document.addEventListener('DOMContentLoaded', () => {
    createSquaresBackground(document.body);
});
