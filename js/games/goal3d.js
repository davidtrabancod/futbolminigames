/* Lightweight WebGL model of the penalty goal. Coordinates are metres. */
class Goal3DRenderer {
  constructor(width = 400, height = 600) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    this.gl = this.canvas.getContext('webgl', {
      alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true
    });
    if (!this.gl) throw new Error('WebGL is unavailable');
    this.program = this.createProgram();
    this.positionBuffer = this.gl.createBuffer();
    this.netBuffer = this.gl.createBuffer();
    this.frameData = [];
    this.buildFrame();
  }

  createProgram() {
    const gl = this.gl;
    const compile = (type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
      return shader;
    };
    const vertex = compile(gl.VERTEX_SHADER, `
      attribute vec3 aPosition;
      attribute vec3 aNormal;
      attribute vec4 aColor;
      varying vec3 vNormal;
      varying vec4 vColor;
      varying vec3 vPosition;
      void main() {
        // Calibrated to the compressed stadium plate: turf converges near
        // y=287 and the goal line sits at y=310.
        // Project both horizontal and vertical coordinates toward that same
        // vanishing point so the rear net follows the grass perspective.
        float depth = max(-aPosition.z, 0.0);
        float perspective = 1.0 / (1.0 + depth / 26.6);
        float px = 200.0 + aPosition.x * 43.8 * perspective;
        float frontY = 310.0 - aPosition.y * 60.25;
        float py = 287.0 + (frontY - 287.0) * perspective;
        gl_Position = vec4(px / 200.0 - 1.0, 1.0 - py / 300.0,
                           0.45 - aPosition.z * 0.025, 1.0);
        vNormal = aNormal;
        vColor = aColor;
        vPosition = aPosition;
      }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec3 vNormal;
      varying vec4 vColor;
      varying vec3 vPosition;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 lightA = normalize(vec3(-0.45, 0.85, 0.7));
        vec3 lightB = normalize(vec3(0.65, 0.35, 0.6));
        float diffuse = max(dot(n, lightA), 0.0) * 0.46 + max(dot(n, lightB), 0.0) * 0.20;
        float specular = pow(max(dot(reflect(-lightA, n), vec3(0.0, 0.15, 1.0)), 0.0), 36.0) * 0.12;
        float stadiumGlow = 0.34 + 0.10 * max(n.y, 0.0);
        gl_FragColor = vec4(vColor.rgb * (stadiumGlow + diffuse) + specular * vColor.a,
                            vColor.a);
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  vertex(out, p, n, color) {
    out.push(p[0], p[1], p[2], n[0], n[1], n[2], color[0], color[1], color[2], color[3]);
  }

  tube(out, start, end, radius, color, sides = 12) {
    const axis = end.map((v, i) => v - start[i]);
    const len = Math.hypot(...axis) || 1;
    const w = axis.map(v => v / len);
    const seed = Math.abs(w[1]) < 0.92 ? [0, 1, 0] : [1, 0, 0];
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    let u = cross(w, seed);
    const ul = Math.hypot(...u) || 1;
    u = u.map(v => v / ul);
    const v = cross(w, u);
    for (let i = 0; i < sides; i++) {
      const a = i * Math.PI * 2 / sides, b = (i + 1) * Math.PI * 2 / sides;
      const na = u.map((q, j) => q * Math.cos(a) + v[j] * Math.sin(a));
      const nb = u.map((q, j) => q * Math.cos(b) + v[j] * Math.sin(b));
      const pa = start.map((q, j) => q + na[j] * radius);
      const pb = start.map((q, j) => q + nb[j] * radius);
      const qa = end.map((q, j) => q + na[j] * radius);
      const qb = end.map((q, j) => q + nb[j] * radius);
      this.vertex(out, pa, na, color); this.vertex(out, qa, na, color); this.vertex(out, qb, nb, color);
      this.vertex(out, pa, na, color); this.vertex(out, qb, nb, color); this.vertex(out, pb, nb, color);
    }
  }

  sphere(out, center, radius, color) {
    const rings = 8, sides = 14;
    for (let r = 0; r < rings; r++) {
      const t0 = -Math.PI / 2 + Math.PI * r / rings;
      const t1 = -Math.PI / 2 + Math.PI * (r + 1) / rings;
      for (let s = 0; s < sides; s++) {
        const p0 = s * Math.PI * 2 / sides, p1 = (s + 1) * Math.PI * 2 / sides;
        const point = (t, p) => [Math.cos(t) * Math.cos(p), Math.sin(t), Math.cos(t) * Math.sin(p)];
        const n00 = point(t0, p0), n01 = point(t0, p1), n10 = point(t1, p0), n11 = point(t1, p1);
        const emit = n => this.vertex(out, center.map((q, i) => q + n[i] * radius), n, color);
        emit(n00); emit(n10); emit(n11); emit(n00); emit(n11); emit(n01);
      }
    }
  }

  buildFrame() {
    const bright = [0.94, 0.96, 0.93, 1];
    const shadow = [0.22, 0.27, 0.26, 1];
    const trim = [0.62, 0.69, 0.66, 1];
    const front = 0, back = -1.9, half = 3.66, top = 2.44;
    const add = (a, b, r, c) => this.tube(this.frameData, a, b, r, c, 16);

    // The front assembly is a single joined U frame, with real circular sections.
    add([-half, 0.02, front], [-half, top, front], 0.055, bright);
    add([-half, top, front], [half, top, front], 0.055, bright);
    add([half, top, front], [half, 0.02, front], 0.055, bright);

    // Rear cage and depth rails make the goal a braced 3D structure planted on the pitch.
    add([-half, 0.02, back], [-half, top, back], 0.038, trim);
    add([-half, top, back], [half, top, back], 0.038, trim);
    add([half, top, back], [half, 0.02, back], 0.038, trim);
    add([-half, 0.02, front], [-half, 0.02, back], 0.046, bright);
    add([half, 0.02, front], [half, 0.02, back], 0.046, bright);
    add([-half, top, front], [-half, top, back], 0.046, bright);
    add([half, top, front], [half, top, back], 0.046, bright);
    add([-half, 0.02, back], [half, 0.02, back], 0.035, shadow);

    // Dark ground shoes and spherical corner sleeves visually join the rails.
    for (const x of [-half, half]) {
      // Small ground shoes replace the oversized ball joints from the first model.
      add([x, 0.025, 0.08], [x, 0.025, -0.22], 0.052, shadow);
    }
  }

  bindBuffer(buffer, data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data instanceof Float32Array ? data : new Float32Array(data), gl.DYNAMIC_DRAW);
  }

  configureAttributes() {
    const gl = this.gl;
    const stride = 10 * 4;
    const position = gl.getAttribLocation(this.program, 'aPosition');
    const normal = gl.getAttribLocation(this.program, 'aNormal');
    const color = gl.getAttribLocation(this.program, 'aColor');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(normal); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(color); gl.vertexAttribPointer(color, 4, gl.FLOAT, false, stride, 6 * 4);
  }

  buildNet(nodes) {
    // Braided nylon is intentionally brighter and more opaque than the old
    // pale overlay so the rear wall reads as a real net against the stadium.
    const out = [], color = [0.78, 0.85, 0.80, 0.58];
    const line = (a, b) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const length = Math.hypot(dx, dy, dz) || 1;
      const normal = [0, 0, 1];
      this.vertex(out, a, normal, color); this.vertex(out, b, normal, color);
    };
    if (nodes?.length) {
      for (let r = 0; r < nodes.length; r++) for (let c = 0; c < nodes[r].length; c++) {
        const n = nodes[r][c], p = [n.x - 3.66, n.y, -n.depth];
        if (c < nodes[r].length - 1) {
          const next = nodes[r][c + 1]; line(p, [next.x - 3.66, next.y, -next.depth]);
        }
        if (r < nodes.length - 1) {
          const next = nodes[r + 1][c]; line(p, [next.x - 3.66, next.y, -next.depth]);
        }
      }
    }

    const half = 3.61, top = 2.39, bottom = 0.07, rear = -1.88;
    const rows = 7, cols = 12;
    for (let i = 0; i <= cols; i++) {
      const x = -half + (2 * half * i / cols);
      line([x, top, 0], [x, top, rear]); line([x, bottom, 0], [x, bottom, rear]);
    }
    for (let i = 0; i <= rows; i++) {
      const y = bottom + (top - bottom) * i / rows;
      line([-half, y, 0], [-half, y, rear]); line([half, y, 0], [half, y, rear]);
    }
    // Fill the roof, floor and side curtains with their own woven grids.
    // These depthwise panels make the net a closed, box-shaped volume rather
    // than a single flat lattice drawn over the goal mouth.
    for (let d = 1; d < 6; d++) {
      const z = rear * d / 6;
      for (let i = 0; i < cols; i++) {
        const x0 = -half + (2 * half * i / cols);
        const x1 = -half + (2 * half * (i + 1) / cols);
        line([x0, top, z], [x1, top, z]);
        line([x0, bottom, z], [x1, bottom, z]);
      }
      for (let i = 0; i < rows; i++) {
        const y0 = bottom + (top - bottom) * i / rows;
        const y1 = bottom + (top - bottom) * (i + 1) / rows;
        line([-half, y0, z], [-half, y1, z]);
        line([half, y0, z], [half, y1, z]);
      }
    }
    for (let i = 0; i <= cols; i++) {
      const x = -half + (2 * half * i / cols);
      line([x, bottom, rear], [x, top, rear]);
    }
    for (let i = 0; i <= rows; i++) {
      const y = bottom + (top - bottom) * i / rows;
      line([-half, y, rear], [half, y, rear]);
    }
    return new Float32Array(out);
  }

  draw(nodes) {
    const gl = this.gl;
    gl.viewport(0, 0, this.width, this.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);

    this.bindBuffer(this.positionBuffer, this.frameData);
    this.configureAttributes();
    gl.drawArrays(gl.TRIANGLES, 0, this.frameData.length / 10);

    const net = this.buildNet(nodes);
    this.bindBuffer(this.netBuffer, net);
    this.configureAttributes();
    gl.depthMask(false);
    gl.drawArrays(gl.LINES, 0, net.length / 10);
    gl.depthMask(true);
    gl.flush();
  }
}

window.Goal3DRenderer = Goal3DRenderer;
