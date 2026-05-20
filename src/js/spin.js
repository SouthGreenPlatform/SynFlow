var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};

var defaults = {
    lines: 12,
    length: 7,
    width: 5,
    radius: 10,
    scale: 1.0,
    corners: 1,
    color: '#000',
    fadeColor: 'transparent',
    animation: 'spinner-line-fade-default',
    rotate: 0,
    direction: 1,
    speed: 1,
    zIndex: 2e9,
    className: 'spinner',
    top: '50%',
    left: '50%',
    shadow: '0 0 1px transparent',
    position: 'absolute',
};

var Spinner = /** @class */ (function () {
    function Spinner(opts) {
        if (opts === void 0) { opts = {}; }
        this.opts = __assign(__assign({}, defaults), opts);
        this.progress = 0;
        this.message = 'Preparing...';
    }

    Spinner.prototype.spin = function (target) {
        this.stop();

        if (!target) return this;

        var computedStyle = window.getComputedStyle(target);
        if (computedStyle.position === 'static') {
            target.style.position = 'relative';
        }

        this.wrapper = document.createElement('div');
        this.wrapper.className = 'spinner-overlay-wrapper';

        css(this.wrapper, {
            position: 'fixed',   // plein écran
            inset: '0',
            zIndex: this.opts.zIndex,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        });

        this.content = document.createElement('div');
        this.content.className = 'spinner-overlay-content';

        css(this.content, {
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '16px',
            minWidth: '260px',
            maxWidth: '320px',
            padding: '20px',
            paddingTop: '40px',
            borderRadius: '12px',
            background: 'rgba(255,255,255,0.96)',
            boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
            textAlign: 'center',
            fontFamily: 'Arial, sans-serif',
        });

        this.el = document.createElement('div');
        this.el.className = this.opts.className;
        this.el.setAttribute('role', 'progressbar');

        css(this.el, {
            position: 'relative',
            width: '20px',
            height: '20px',
        });

        this.messageEl = document.createElement('div');
        this.messageEl.textContent = this.message || 'Preparing...';

        css(this.messageEl, {
            fontSize: '14px',
            color: '#222',
        });

        this.progressBarOuter = document.createElement('div');
        css(this.progressBarOuter, {
            width: '100%',
            height: '8px',
            background: '#e5e7eb',
            borderRadius: '999px',
            overflow: 'hidden',
        });

        this.progressBarInner = document.createElement('div');
        css(this.progressBarInner, {
            width: (this.progress || 0) + '%',
            height: '100%',
            background: '#2563eb',
            borderRadius: '999px',
            transition: 'width 0.25s ease',
        });

        this.progressTextEl = document.createElement('div');
        this.progressTextEl.textContent = (this.progress || 0) + '%';

        css(this.progressTextEl, {
            fontSize: '12px',
            color: '#666',
        });

        this.progressBarOuter.appendChild(this.progressBarInner);

        this.content.appendChild(this.el);
        this.content.appendChild(this.messageEl);
        this.content.appendChild(this.progressBarOuter);
        this.content.appendChild(this.progressTextEl);

        this.wrapper.appendChild(this.content);

        document.body.appendChild(this.wrapper);

        drawLines(this.el, this.opts);
        return this;
    };

    Spinner.prototype.setStep = function (message, progress) {
        if (message !== undefined) {
            this.message = message;
        }
        if (progress !== undefined) {
            this.progress = Math.max(0, Math.min(100, progress));
        }

        if (this.messageEl) {
            this.messageEl.textContent = this.message;
        }
        if (this.progressBarInner) {
            this.progressBarInner.style.width = this.progress + '%';
        }
        if (this.progressTextEl) {
            this.progressTextEl.textContent = this.progress + '%';
        }

        return this;
    };

    Spinner.prototype.stop = function () {
        if (this.el) {
            if (typeof requestAnimationFrame !== 'undefined') {
                cancelAnimationFrame(this.animateId);
            } else {
                clearTimeout(this.animateId);
            }
        }

        if (this.wrapper && this.wrapper.parentNode) {
            this.wrapper.parentNode.removeChild(this.wrapper);
        }

        this.el = undefined;
        this.wrapper = undefined;
        this.infoBox = undefined;
        this.messageEl = undefined;
        this.progressBarOuter = undefined;
        this.progressBarInner = undefined;
        this.progressTextEl = undefined;

        return this;
    };

    return Spinner;
}());

export { Spinner };

function css(el, props) {
    for (var prop in props) {
        el.style[prop] = props[prop];
    }
    return el;
}

function getColor(color, idx) {
    return typeof color == 'string' ? color : color[idx % color.length];
}

function drawLines(el, opts) {
    var borderRadius = (Math.round(opts.corners * opts.width * 500) / 1000) + 'px';
    var shadow = 'none';
    if (opts.shadow === true) {
        shadow = '0 2px 4px #000';
    }
    else if (typeof opts.shadow === 'string') {
        shadow = opts.shadow;
    }
    var shadows = parseBoxShadow(shadow);

    for (var i = 0; i < opts.lines; i++) {
        var degrees = ~~(360 / opts.lines * i + opts.rotate);

        var backgroundLine = css(document.createElement('div'), {
            position: 'absolute',
            top: -opts.width / 2 + "px",
            width: (opts.length + opts.width) + 'px',
            height: opts.width + 'px',
            background: getColor(opts.fadeColor, i),
            borderRadius: borderRadius,
            transformOrigin: 'left',
            transform: "rotate(" + degrees + "deg) translateX(" + opts.radius + "px)",
        });

        var delay = i * opts.direction / opts.lines / opts.speed;
        delay -= 1 / opts.speed;

        var line = css(document.createElement('div'), {
            width: '100%',
            height: '100%',
            background: getColor(opts.color, i),
            borderRadius: borderRadius,
            boxShadow: normalizeShadow(shadows, degrees),
            animation: 1 / opts.speed + "s linear " + delay + "s infinite " + opts.animation,
        });

        backgroundLine.appendChild(line);
        el.appendChild(backgroundLine);
    }
}

function parseBoxShadow(boxShadow) {
    var regex = /^\s*([a-zA-Z]+\s+)?(-?\d+(\.\d+)?)([a-zA-Z]*)\s+(-?\d+(\.\d+)?)([a-zA-Z]*)(.*)$/;
    var shadows = [];

    for (var _i = 0, _a = boxShadow.split(','); _i < _a.length; _i++) {
        var shadow = _a[_i];
        var matches = shadow.match(regex);
        if (matches === null) {
            continue;
        }

        var x = +matches[2];
        var y = +matches[5];
        var xUnits = matches[4];
        var yUnits = matches[7];

        if (x === 0 && !xUnits) {
            xUnits = yUnits;
        }
        if (y === 0 && !yUnits) {
            yUnits = xUnits;
        }
        if (xUnits !== yUnits) {
            continue;
        }

        shadows.push({
            prefix: matches[1] || '',
            x: x,
            y: y,
            xUnits: xUnits,
            yUnits: yUnits,
            end: matches[8],
        });
    }

    return shadows;
}

function normalizeShadow(shadows, degrees) {
    var normalized = [];

    for (var _i = 0, shadows_1 = shadows; _i < shadows_1.length; _i++) {
        var shadow = shadows_1[_i];
        var xy = convertOffset(shadow.x, shadow.y, degrees);
        normalized.push(shadow.prefix + xy[0] + shadow.xUnits + ' ' + xy[1] + shadow.yUnits + shadow.end);
    }

    return normalized.join(', ');
}

function convertOffset(x, y, degrees) {
    var radians = degrees * Math.PI / 180;
    var sin = Math.sin(radians);
    var cos = Math.cos(radians);

    return [
        Math.round((x * cos + y * sin) * 1000) / 1000,
        Math.round((-x * sin + y * cos) * 1000) / 1000,
    ];
}