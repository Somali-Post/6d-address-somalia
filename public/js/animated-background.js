export class AnimatedBackground {
    constructor(options) {
        this.canvas = document.getElementById(options.canvasId);
        if (!this.canvas) {
            console.error(`Canvas with ID "${options.canvasId}" not found.`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        this.options = {
            squareSize: options.squareSize || 40,
            speed: options.speed || 1,
            direction: options.direction || 'right',
            borderColor: options.borderColor || 'rgba(255, 255, 255, 0.1)',
            hoverFillColor: options.hoverFillColor || 'rgba(255, 255, 255, 0.05)',
        };

        this.gridOffset = { x: 0, y: 0 };
        this.hoveredSquare = null;
        this.animationFrameId = null;

        // Bind methods to ensure 'this' context is correct
        this.resizeCanvas = this.resizeCanvas.bind(this);
        this.updateAnimation = this.updateAnimation.bind(this);
        this.handleMouseMove = this.handleMouseMove.bind(this);
        this.handleMouseLeave = this.handleMouseLeave.bind(this);
    }

    init() {
        window.addEventListener('resize', this.resizeCanvas);
        this.canvas.addEventListener('mousemove', this.handleMouseMove);
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave);
        this.resizeCanvas();
        this.updateAnimation();
    }

    destroy() {
        window.removeEventListener('resize', this.resizeCanvas);
        this.canvas.removeEventListener('mousemove', this.handleMouseMove);
        this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
    }

    resizeCanvas() {
        // --- HIGH-DPI FIX ---
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.offsetWidth * dpr;
        this.canvas.height = this.canvas.offsetHeight * dpr;
        this.ctx.scale(dpr, dpr);
        // --- END OF FIX ---
    }

    drawGrid() {
        const { squareSize, borderColor, hoverFillColor } = this.options;
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;

        this.ctx.clearRect(0, 0, width, height);
        this.ctx.lineWidth = 1;

        for (let i = 0; i < (width / squareSize) + 1; i++) {
            for (let j = 0; j < (height / squareSize) + 1; j++) {
                const x = i * squareSize - (this.gridOffset.x % squareSize);
                const y = j * squareSize - (this.gridOffset.y % squareSize);

                if (this.hoveredSquare && i === this.hoveredSquare.x && j === this.hoveredSquare.y) {
                    this.ctx.fillStyle = hoverFillColor;
                    this.ctx.fillRect(x, y, squareSize, squareSize);
                }

                this.ctx.strokeStyle = borderColor;
                this.ctx.strokeRect(x, y, squareSize, squareSize);
            }
        }
    }

    updateAnimation() {
        const { speed, direction, squareSize } = this.options;
        const effectiveSpeed = Math.max(speed, 0.1);

        switch (direction) {
            case 'right': this.gridOffset.x = (this.gridOffset.x + effectiveSpeed) % squareSize; break;
            case 'left': this.gridOffset.x = (this.gridOffset.x - effectiveSpeed + squareSize) % squareSize; break;
            case 'up': this.gridOffset.y = (this.gridOffset.y - effectiveSpeed + squareSize) % squareSize; break;
            case 'down': this.gridOffset.y = (this.gridOffset.y + effectiveSpeed) % squareSize; break;
            case 'diagonal':
                this.gridOffset.x = (this.gridOffset.x + effectiveSpeed) % squareSize;
                this.gridOffset.y = (this.gridOffset.y + effectiveSpeed) % squareSize;
                break;
        }

        this.drawGrid();
        this.animationFrameId = requestAnimationFrame(this.updateAnimation);
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const x = Math.floor((mouseX + (this.gridOffset.x % this.options.squareSize)) / this.options.squareSize);
        const y = Math.floor((mouseY + (this.gridOffset.y % this.options.squareSize)) / this.options.squareSize);
        this.hoveredSquare = { x, y };
    }

    handleMouseLeave() {
        this.hoveredSquare = null;
    }

    updateColors(newColors) {
        if (newColors.borderColor) this.options.borderColor = newColors.borderColor;
        if (newColors.hoverFillColor) this.options.hoverFillColor = newColors.hoverFillColor;
    }
}