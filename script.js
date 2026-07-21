const canvas = document.getElementById('heartCanvas');
const ctx = canvas.getContext('2d');
const videoWrapper = document.getElementById('videoWrapper');
const blackOverlay = document.getElementById('blackOverlay');
const instruction = document.getElementById('instruction');
const bgVideo = document.getElementById('bgVideo');
const bgAudio = document.getElementById('bgAudio');

let width = canvas.width = window.innerWidth;
let height = canvas.height = window.innerHeight;

// Tối ưu hóa Canvas cho màn hình Retina / Mật độ điểm ảnh cao
const dpr = Math.min(window.devicePixelRatio || 1, 2);
function resizeCanvas() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

let hue = 330; 
const totalParticles = 2500; // Giữ nguyên độ dày & lộng lẫy chi tiết
const particles = [];

const MAX_PETALS = 800; 
const petals = [];

let isHeartBroken = false;
let isHolding = false;
let holdTimer = null;
let clickStartTime = 0;

let mouseX = -1000, mouseY = -1000;
let heartOffsetX = 0, heartOffsetY = 0;
let revealProgress = 0;

class FlowParticle3D {
    constructor() {
        this.reset(true);
    }

    reset(randomStart = false) {
        this.u = randomStart ? Math.random() * Math.PI : 0.05; 
        this.v = (Math.random() - 0.5) * Math.PI * 2;
        this.speedU = 0.008 + Math.random() * 0.012; 
        this.layerScale = 0.8 + Math.random() * 0.4;

        this.size = Math.random() * 2.2 + 0.8;
        this.colorOffset = (Math.random() * 30 - 15);
        this.alpha = 1;

        this.exploded = false;
        this.vx = 0; this.vy = 0; this.vz = 0;
        this.currX = 0; this.currY = 0; this.currZ = 0;
    }

    explode() {
        this.exploded = true;
        let angle = Math.random() * Math.PI * 2;
        let speed = Math.random() * 45 + 15; 
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed - (Math.random() * 20 + 10);
        this.vz = (Math.random() - 0.5) * 35;
    }

    update(angleX, angleY, beatScale) {
        if (this.exploded) {
            if (this.alpha <= 0) return;

            this.currX += this.vx;
            this.currY += this.vy;
            this.currZ += this.vz;

            this.vy += 0.6;
            this.vx *= 0.94;
            this.vy *= 0.94;
            this.vz *= 0.94;

            let perspective = 380 / (380 + this.currZ);
            this.projX = this.currX * perspective + width / 2;
            this.projY = this.currY * perspective + height / 2;

            if (Math.random() < 0.5) {
                spawnPetal(this.projX, this.projY);
                this.alpha = 0;
            }

            this.projSize = this.size * perspective;
            this.depth = this.currZ;
            return;
        }

        this.u += this.speedU;
        if (this.u >= Math.PI) this.reset(false);

        if (this.u < 0.3) this.alpha = this.u / 0.3;
        else if (this.u > Math.PI - 0.3) this.alpha = (Math.PI - this.u) / 0.3;
        else this.alpha = 1;

        let sinU = Math.sin(this.u);
        let cosU = Math.cos(this.u);

        let rawX = 16 * Math.pow(sinU, 3) * Math.sin(this.v);
        let rawY = -(13 * cosU - 5 * Math.cos(2 * this.u) - 2 * Math.cos(3 * this.u) - Math.cos(4 * this.u));
        let rawZ = 16 * Math.pow(sinU, 3) * Math.cos(this.v);

        let currentX = rawX * this.layerScale * beatScale;
        let currentY = rawY * this.layerScale * beatScale;
        let currentZ = rawZ * this.layerScale * beatScale;

        let cosY = Math.cos(angleY), sinY = Math.sin(angleY);
        let x1 = currentX * cosY - currentZ * sinY;
        let z1 = currentZ * cosY + currentX * sinY;

        let cosX = Math.cos(angleX), sinX = Math.sin(angleX);
        let y2 = currentY * cosX - z1 * sinX;
        let z2 = z1 * cosX + currentY * sinX;

        this.currX = x1;
        this.currY = y2;
        this.currZ = z2;

        let perspective = 380 / (380 + z2);
        this.projX = x1 * perspective + width / 2 + heartOffsetX;
        this.projY = y2 * perspective + height / 2 - 20 + heartOffsetY;
        this.projSize = this.size * perspective;
        this.depth = z2;
    }

    draw() {
        if (this.projSize <= 0 || this.alpha <= 0) return;

        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = `hsl(${(hue + this.colorOffset) % 360}, 100%, 70%)`;
        ctx.beginPath();
        ctx.arc(this.projX, this.projY, this.projSize, 0, Math.PI * 2);
        ctx.fill();
    }
}

class TorrentPetal {
    constructor() {
        this.active = false;
    }

    spawn(x, y) {
        this.active = true;
        this.x = x || Math.random() * width;
        this.y = y || (Math.random() * -150 - 20);
        this.size = Math.random() * 12 + 6;
        
        this.speedY = 8 + Math.random() * 10; 
        this.speedX = (Math.random() - 0.5) * 6; 

        this.rotationX = Math.random() * Math.PI;
        this.rotationY = Math.random() * Math.PI;
        this.spinSpeedX = (Math.random() - 0.5) * 0.2;
        this.spinSpeedY = (Math.random() - 0.5) * 0.2;

        this.alpha = 1;
        this.color = Math.random() < 0.7 ? '#ffffff' : '#ffb6c1';
    }

    update() {
        if (!this.active) return;

        this.y += this.speedY;
        this.x += this.speedX;

        this.rotationX += this.spinSpeedX;
        this.rotationY += this.spinSpeedY;

        if (this.y > height + 40) {
            this.active = false;
        }
    }

    draw() {
        if (!this.active || this.alpha <= 0) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.scale(Math.cos(this.rotationX), Math.sin(this.rotationY));

        ctx.globalAlpha = this.alpha;
        ctx.fillStyle = this.color;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(-this.size, -this.size / 2, -this.size, this.size, 0, this.size * 1.5);
        ctx.bezierCurveTo(this.size, this.size, this.size, -this.size / 2, 0, 0);
        ctx.fill();

        ctx.restore();
    }
}

for (let i = 0; i < totalParticles; i++) particles.push(new FlowParticle3D());
for (let i = 0; i < MAX_PETALS; i++) petals.push(new TorrentPetal());

function spawnPetal(x, y) {
    let petal = petals.find(p => !p.active);
    if (petal) petal.spawn(x, y);
}

function changeHeartColor() {
    hue = (hue + 45) % 360; 
}

function breakHeart() {
    isHeartBroken = true;
    revealProgress = 0;
    
    particles.forEach(p => p.explode());
    for (let i = 0; i < 350; i++) spawnPetal();

    if (bgVideo) {
        bgVideo.play().catch(e => console.log(e));
    }

    if (bgAudio) {
        bgAudio.currentTime = 0;
        bgAudio.play().catch(e => console.log(e));
    }

    instruction.innerText = '✨ Nhấp / Chạm lần nữa để thu hồi Trái Tim ban đầu ✨';
}

function restoreHeart() {
    isHeartBroken = false;
    revealProgress = 0;
    
    videoWrapper.style.setProperty('--reveal-progress', '0%');
    blackOverlay.style.opacity = '1';

    petals.forEach(p => p.active = false);
    particles.forEach(p => p.reset(true));

    if (bgVideo) bgVideo.pause();
    if (bgAudio) bgAudio.pause();

    instruction.innerText = '💡 Click: Đổi màu | Rê chuột: Né nhẹ | Nhấn & Giữ: Vỡ tung mưa hoa ào ạt';
}

window.addEventListener('mousedown', () => {
    clickStartTime = Date.now();
    isHolding = true;

    if (isHeartBroken) {
        restoreHeart();
        return;
    }

    holdTimer = setTimeout(() => {
        if (isHolding && !isHeartBroken) breakHeart();
    }, 350);
});

window.addEventListener('mouseup', () => {
    let holdDuration = Date.now() - clickStartTime;
    isHolding = false;
    clearTimeout(holdTimer);

    if (holdDuration < 350 && !isHeartBroken) changeHeartColor();
});

// Hỗ trợ mượt cho màn hình cảm ứng điện thoại
window.addEventListener('touchstart', (e) => {
    clickStartTime = Date.now();
    isHolding = true;

    if (isHeartBroken) {
        restoreHeart();
        return;
    }

    holdTimer = setTimeout(() => {
        if (isHolding && !isHeartBroken) breakHeart();
    }, 350);
});

window.addEventListener('touchend', () => {
    let holdDuration = Date.now() - clickStartTime;
    isHolding = false;
    clearTimeout(holdTimer);

    if (holdDuration < 350 && !isHeartBroken) changeHeartColor();
});

let angleX = 0, angleY = 0, targetAngleX = 0, targetAngleY = 0;
window.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;

    if (!isHeartBroken) {
        targetAngleY = (mouseX - width / 2) * 0.002;
        targetAngleX = (mouseY - height / 2) * 0.002;
    }
});

let time = 0;

function animate() {
    ctx.clearRect(0, 0, width, height);

    time += 0.04;
    let beatScale = 11 + Math.sin(time * 2) * 0.6 + Math.pow(Math.sin(time * 4), 2) * 0.3;

    if (!isHeartBroken) {
        let dx = mouseX - width / 2;
        let dy = mouseY - (height / 2 - 20);
        let dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 160 && dist > 0) {
            let maxEvadeDist = 22; 
            heartOffsetX += (-(dx / dist) * maxEvadeDist - heartOffsetX) * 0.1;
            heartOffsetY += (-(dy / dist) * maxEvadeDist - heartOffsetY) * 0.1;
        } else {
            heartOffsetX += (0 - heartOffsetX) * 0.08;
            heartOffsetY += (0 - heartOffsetY) * 0.08;
        }
    }

    angleY += (targetAngleY + 0.005 - angleY) * 0.05;
    angleX += (targetAngleX - angleX) * 0.05;

    particles.forEach(p => p.update(angleX, angleY, beatScale));
    
    // Sắp xếp hạt theo chiều sâu
    particles.sort((a, b) => b.depth - a.depth);
    particles.forEach(p => p.draw());

    petals.forEach(p => {
        if (p.active) {
            p.update();
            p.draw();
        }
    });

    if (isHeartBroken) {
        let maxY = 0;
        let activeCount = 0;

        petals.forEach(p => {
            if (p.active) {
                activeCount++;
                if (p.y > maxY) maxY = p.y;
            }
        });

        if (activeCount > 0) {
            let targetProg = (maxY / height) * 100;
            if (targetProg > revealProgress) {
                revealProgress = Math.min(100, targetProg);
            }
        }

        videoWrapper.style.setProperty('--reveal-progress', `${revealProgress}%`);

        if (revealProgress >= 95) blackOverlay.style.opacity = '0';

        if (revealProgress < 100) {
            for (let i = 0; i < 3; i++) spawnPetal();
        }
    }

    requestAnimationFrame(animate);
}

animate();