// Initialize Matter.js
const Engine = Matter.Engine;
const Render = Matter.Render;
const World = Matter.World;
const Bodies = Matter.Bodies;
const Body = Matter.Body;
const Vector = Matter.Vector;

// Create engine and world
const engine = Engine.create();
const world = engine.world;

// Disable gravity initially
world.gravity.y = 0;

// Canvas setup
const canvas = document.getElementById('spaceTimeCanvas');
const ctx = canvas.getContext('2d');

// Set canvas size
function resizeCanvas() {
    canvas.width = window.innerWidth - 250; // Subtract sidebar width
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Grid parameters
const gridSize = 40;
const gridColor = '#0f0';
const gridLineWidth = 2;

// Space-time fabric grid
class SpaceTimeGrid {
    constructor() {
        this.points = [];
        this.initGrid();
    }

    initGrid() {
        const cols = Math.ceil(canvas.width / gridSize);
        const rows = Math.ceil(canvas.height / gridSize);

        for (let i = 0; i <= cols; i++) {
            for (let j = 0; j <= rows; j++) {
                this.points.push({
                    x: i * gridSize,
                    y: j * gridSize,
                    baseX: i * gridSize,
                    baseY: j * gridSize,
                    displacement: 0
                });
            }
        }
    }

    updateGrid(objects) {
        this.points.forEach(point => {
            let totalDisplacement = 0;
            objects.forEach(obj => {
                const dx = point.baseX - obj.body.position.x;
                const dy = point.baseY - obj.body.position.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                const force = (obj.mass * 1000) / (distance * distance);
                totalDisplacement += Math.min(force, 50);
            });
            point.displacement = totalDisplacement;
            point.x = point.baseX;
            point.y = point.baseY + point.displacement;
        });
    }

    draw() {
        const cols = Math.ceil(canvas.width / gridSize);
        const rows = Math.ceil(canvas.height / gridSize);

        ctx.strokeStyle = gridColor;
        ctx.lineWidth = gridLineWidth;

        // Draw vertical lines
        for (let i = 0; i <= cols; i++) {
            ctx.beginPath();
            for (let j = 0; j <= rows; j++) {
                const point = this.points[i * (rows + 1) + j];
                if (j === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();
        }

        // Draw horizontal lines
        for (let j = 0; j <= rows; j++) {
            ctx.beginPath();
            for (let i = 0; i <= cols; i++) {
                const point = this.points[i * (rows + 1) + j];
                if (i === 0) {
                    ctx.moveTo(point.x, point.y);
                } else {
                    ctx.lineTo(point.x, point.y);
                }
            }
            ctx.stroke();
        }
    }
}

// Celestial objects
class CelestialObject {
    constructor(x, y, type, mass) {
        this.type = type;
        this.mass = mass;
        this.radius = this.getRadius();

        this.body = Bodies.circle(x, y, this.radius, {
            density: mass,
            friction: 0.1,
            restitution: 0.6,
            render: {
                fillStyle: '#0f0'
            }
        });

        World.add(world, this.body);
    }

    getRadius() {
        switch (this.type) {
            case 'small-planet': return 15;
            case 'medium-planet': return 25;
            case 'large-planet': return 35;
            case 'blackhole': return 40;
            default: return 20;
        }
    }

    draw() {
        const pos = this.body.position;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, this.radius, 0, Math.PI * 2);

        if (this.type === 'blackhole') {
            ctx.fillStyle = '#000';
            ctx.strokeStyle = '#0f0';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();

            // Draw black hole effect
            const gradient = ctx.createRadialGradient(
                pos.x, pos.y, this.radius,
                pos.x, pos.y, this.radius * 2
            );
            gradient.addColorStop(0, 'rgba(0, 255, 0, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 255, 0, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();
        } else {
            ctx.fillStyle = '#0f0';
            ctx.fill();
        }
    }

    applyGravitationalForce(otherObject) {
        const dx = otherObject.body.position.x - this.body.position.x;
        const dy = otherObject.body.position.y - this.body.position.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < this.radius + otherObject.radius) {
            if (this.type === 'blackhole') {
                World.remove(world, otherObject.body);
                return true;
            }
            return false;
        }

        const force = (this.mass * otherObject.mass) / (distance * distance);
        const angle = Math.atan2(dy, dx);

        Body.applyForce(otherObject.body, otherObject.body.position, {
            x: Math.cos(angle) * force * 0.0001,
            y: Math.sin(angle) * force * 0.0001
        });

        return false;
    }
}

// Handle drag and drop
const objects = [];
let draggedObject = null;
const grid = new SpaceTimeGrid();

document.querySelectorAll('.object').forEach(element => {
    element.addEventListener('dragstart', (e) => {
        draggedObject = {
            type: element.dataset.type,
            mass: parseFloat(element.dataset.mass)
        };
    });
});

canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    if (draggedObject) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newObject = new CelestialObject(x, y, draggedObject.type, draggedObject.mass);
        objects.push(newObject);
        draggedObject = null;
    }
});

// Animation loop
function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update physics
    Engine.update(engine, 1000 / 60);

    // Update and draw grid
    grid.updateGrid(objects);
    grid.draw();

    // Draw objects and handle interactions
    objects.forEach((obj, index) => {
        obj.draw();

        // Handle gravitational interactions
        for (let i = objects.length - 1; i >= 0; i--) {
            if (i !== index) {
                const removed = obj.applyGravitationalForce(objects[i]);
                if (removed) {
                    objects.splice(i, 1);
                }
            }
        }
    });

    requestAnimationFrame(animate);
}

// Start animation
animate(); 