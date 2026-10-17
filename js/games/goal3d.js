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
        float px = 200.0 + aPosition.x * 49.932 * perspective;
        float frontY = 310.0 - aPosition.y * 74.784;
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

    // Keep the side rails, but leave the back of the net unsupported by a rigid
    // U-frame. Two short struts sit outside the net and hold only its rear corners.
    add([-half, 0.02, front], [-half, 0.02, back], 0.046, bright);
    add([half, 0.02, front], [half, 0.02, back], 0.046, bright);
    add([-half, top, front], [-half, top, back], 0.046, bright);
    add([half, top, front], [half, top, back], 0.046, bright);
    for (const side of [-1, 1]) {
      const corner = [side * (half - 0.16), top - 0.08, back + 0.02];
      const foot = [side * (half + 0.46), 0.035, back - 0.22];
      add(corner, foot, 0.034, trim);
      add([foot[0] - side * 0.12, 0.035, foot[2] - 0.08],
          [foot[0] + side * 0.12, 0.035, foot[2] + 0.08], 0.045, shadow);
    }

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

  buildNet(nodes, impactPoint = null) {
    // Braided nylon is intentionally brighter and more opaque than the old
    // pale overlay so the rear wall reads as a real net against the stadium.
    const out = [], baseColor = [0.78, 0.85, 0.80, 0.58];
    const line = (a, b, flex = 0) => {
      const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2];
      const length = Math.hypot(dx, dy, dz) || 1;
      const normal = [0, 0, 1];
      const highlight = Math.min(.34, Math.abs(flex) * 1.2);
      const color = [
        Math.min(1, baseColor[0] + highlight),
        Math.min(1, baseColor[1] + highlight),
        Math.min(1, baseColor[2] + highlight),
        Math.min(.94, baseColor[3] + highlight * .75)
      ];
      this.vertex(out, a, normal, color); this.vertex(out, b, normal, color);
    };
    const position = node => {
      const flex = node.depth - (node.origDepth ?? 1.8);
      // Render the solved mesh directly. Radially scaling it around the hit
      // point made the side columns spill past the posts during a hard shot.
      return [node.x - 3.66, node.y, -Math.max(0, node.depth + flex * .35)];
    };
    if (nodes?.length) {
      for (let r = 0; r < nodes.length; r++) for (let c = 0; c < nodes[r].length; c++) {
        const n = nodes[r][c];
        // Keep the rest mesh fixed; only its live impact displacement changes
        // the rendered pocket and tension highlights.
        const flex = n.depth - (n.origDepth ?? 1.8);
        const p = position(n);
        if (c < nodes[r].length - 1) {
          const next = nodes[r][c + 1];
          line(p, position(next), Math.max(Math.abs(flex), Math.abs(next.depth - (next.origDepth ?? 1.8))));
        }
        if (r < nodes.length - 1) {
          const next = nodes[r + 1][c];
          line(p, position(next), Math.max(Math.abs(flex), Math.abs(next.depth - (next.origDepth ?? 1.8))));
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
    // The rear wall is the deformable node grid above. Drawing a second,
    // rigid lattice here would sit in front of the pocket and hide its motion.
    return new Float32Array(out);
  }

  draw(nodes, impactPoint = null) {
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

    const net = this.buildNet(nodes, impactPoint);
    this.bindBuffer(this.netBuffer, net);
    this.configureAttributes();
    gl.depthMask(false);
    gl.drawArrays(gl.LINES, 0, net.length / 10);
    gl.depthMask(true);
    gl.flush();
  }
}

// A real truncated-icosahedron football, shaded and spun in its own WebGL pass.
// Its screen-space center follows the game trajectory while the mesh itself is 3D.
class Football3DRenderer {
  constructor(width = 400, height = 600) {
    this.width = width;
    this.height = height;
    // Supersample the small, fast-moving ball before compositing it into the
    // game's logical canvas, so its silhouette and panels stay crisp.
    this.pixelRatio = Math.min(3, Math.max(2, window.devicePixelRatio || 2));
    this.canvas = document.createElement('canvas');
    this.canvas.width = Math.round(width * this.pixelRatio);
    this.canvas.height = Math.round(height * this.pixelRatio);
    this.gl = this.canvas.getContext('webgl', {
      alpha: true, antialias: true, premultipliedAlpha: false, preserveDrawingBuffer: true
    });
    if (!this.gl) throw new Error('WebGL is unavailable for the football');
    this.program = this.createBallProgram();
    this.triangleBuffer = this.gl.createBuffer();
    this.seamBuffer = this.gl.createBuffer();
    const mesh = this.buildSoccerBall();
    this.triangleData = mesh.triangles;
    this.seamData = mesh.seams;
    this.uploadBuffer(this.triangleBuffer, this.triangleData);
    this.uploadBuffer(this.seamBuffer, this.seamData);
  }

  createBallProgram() {
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
      uniform vec2 uCenter;
      uniform float uRadius;
      uniform float uRotation;
      varying vec3 vNormal;
      varying vec4 vColor;
      varying float vFacing;
      void main() {
        float c = cos(uRotation), s = sin(uRotation);
        vec3 p = vec3(aPosition.x * c + aPosition.z * s,
                      aPosition.y,
                      -aPosition.x * s + aPosition.z * c);
        float cx = cos(uRotation * 0.68), sx = sin(uRotation * 0.68);
        p = vec3(p.x, p.y * cx - p.z * sx, p.y * sx + p.z * cx);
        vec3 n = vec3(aNormal.x * c + aNormal.z * s,
                      aNormal.y,
                      -aNormal.x * s + aNormal.z * c);
        n = vec3(n.x, n.y * cx - n.z * sx, n.y * sx + n.z * cx);
        float px = uCenter.x + p.x * uRadius;
        float py = uCenter.y - p.y * uRadius;
        gl_Position = vec4(px / 200.0 - 1.0, 1.0 - py / 300.0,
                           0.28 - p.z * 0.25, 1.0);
        vNormal = normalize(n);
        vColor = aColor;
        vFacing = p.z;
      }
    `);
    const fragment = compile(gl.FRAGMENT_SHADER, `
      precision mediump float;
      varying vec3 vNormal;
      varying vec4 vColor;
      varying float vFacing;
      void main() {
        vec3 n = normalize(vNormal);
        vec3 light = normalize(vec3(-0.48, 0.68, 0.9));
        float diffuse = max(dot(n, light), 0.0);
        float ambient = 0.34 + max(n.y, 0.0) * 0.08;
        float specular = pow(max(dot(reflect(-light, n), vec3(0.0, 0.0, 1.0)), 0.0), 34.0) * 0.3;
        float rim = pow(1.0 - max(vFacing, 0.0), 2.0) * 0.13;
        gl_FragColor = vec4(vColor.rgb * (ambient + diffuse * 0.72 + rim) + specular, vColor.a);
      }
    `);
    const program = gl.createProgram();
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
  }

  buildSoccerBall() {
    const phi = (1 + Math.sqrt(5)) / 2;
    const normalize = p => {
      const length = Math.hypot(p[0], p[1], p[2]) || 1;
      return p.map(value => value / length);
    };
    const vertices = [
      [-1, phi, 0], [1, phi, 0], [-1, -phi, 0], [1, -phi, 0],
      [0, -1, phi], [0, 1, phi], [0, -1, -phi], [0, 1, -phi],
      [phi, 0, -1], [phi, 0, 1], [-phi, 0, -1], [-phi, 0, 1]
    ].map(normalize);
    const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    const sub = (a, b) => a.map((value, index) => value - b[index]);
    const faces = [];
    for (let a = 0; a < vertices.length; a++) for (let b = a + 1; b < vertices.length; b++) for (let c = b + 1; c < vertices.length; c++) {
      let normal = cross(sub(vertices[b], vertices[a]), sub(vertices[c], vertices[a]));
      const normalLength = Math.hypot(...normal);
      normal = normal.map(value => value / normalLength);
      const side = vertices.map((point, index) => index === a || index === b || index === c
        ? 0 : dot(normal, sub(point, vertices[a])));
      if (side.some(value => value > 1e-5) && side.some(value => value < -1e-5)) continue;
      let face = [a, b, c];
      if (dot(normal, vertices[a]) < 0) face = [a, c, b];
      faces.push(face);
    }

    const neighbors = vertices.map(() => new Set());
    for (const [a, b, c] of faces) {
      neighbors[a].add(b); neighbors[a].add(c);
      neighbors[b].add(a); neighbors[b].add(c);
      neighbors[c].add(a); neighbors[c].add(b);
    }
    const cut = (a, b) => normalize(vertices[a].map((value, i) => (2 * value + vertices[b][i]) / 3));
    const polygons = [];
    for (let i = 0; i < vertices.length; i++) {
      const center = vertices[i];
      const reference = Math.abs(center[1]) < .9 ? [0, 1, 0] : [1, 0, 0];
      const tangent = normalize(cross(center, reference));
      const bitangent = cross(center, tangent);
      const ordered = [...neighbors[i]].map(other => ({
        point: cut(i, other),
        angle: Math.atan2(dot(cut(i, other), bitangent), dot(cut(i, other), tangent))
      })).sort((left, right) => left.angle - right.angle).map(item => item.point);
      polygons.push({ points: ordered, color: [0.055, 0.075, 0.095, 1] });
    }
    for (const [a, b, c] of faces) {
      polygons.push({
        points: [cut(a, b), cut(b, a), cut(b, c), cut(c, b), cut(c, a), cut(a, c)],
        color: [0.88, 0.91, 0.9, 1]
      });
    }

    const triangles = [], seams = [], seenEdges = new Set();
    const emit = (out, point, color, scale = 1) => {
      const p = point.map(value => value * scale);
      out.push(...p, ...point, color[0], color[1], color[2], color[3]);
    };
    for (const polygon of polygons) {
      const center = normalize(polygon.points.reduce((sum, point) => sum.map((value, i) => value + point[i]), [0, 0, 0]));
      for (let i = 0; i < polygon.points.length; i++) {
        emit(triangles, center, polygon.color);
        emit(triangles, polygon.points[i], polygon.color);
        emit(triangles, polygon.points[(i + 1) % polygon.points.length], polygon.color);
        const a = polygon.points[i], b = polygon.points[(i + 1) % polygon.points.length];
        const keyA = a.map(value => value.toFixed(4)).join(',');
        const keyB = b.map(value => value.toFixed(4)).join(',');
        const key = keyA < keyB ? `${keyA}|${keyB}` : `${keyB}|${keyA}`;
        if (!seenEdges.has(key)) {
          seenEdges.add(key);
          const seam = [0.025, 0.038, 0.052, 1];
          emit(seams, a, seam, 1.004); emit(seams, b, seam, 1.004);
        }
      }
    }
    return { triangles: new Float32Array(triangles), seams: new Float32Array(seams) };
  }

  uploadBuffer(buffer, data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  bindAttributes(buffer) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const stride = 10 * 4;
    const position = gl.getAttribLocation(this.program, 'aPosition');
    const normal = gl.getAttribLocation(this.program, 'aNormal');
    const color = gl.getAttribLocation(this.program, 'aColor');
    gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(normal); gl.vertexAttribPointer(normal, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(color); gl.vertexAttribPointer(color, 4, gl.FLOAT, false, stride, 6 * 4);
  }

  draw(ball) {
    const gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(0, 0, 0, 0);
    gl.clearDepth(1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.useProgram(this.program);
    gl.uniform2f(gl.getUniformLocation(this.program, 'uCenter'), ball.x, ball.y);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uRadius'), ball.radius * ball.scale);
    gl.uniform1f(gl.getUniformLocation(this.program, 'uRotation'), ball.rotation);
    this.bindAttributes(this.triangleBuffer);
    gl.drawArrays(gl.TRIANGLES, 0, this.triangleData.length / 10);
    this.bindAttributes(this.seamBuffer);
    gl.drawArrays(gl.LINES, 0, this.seamData.length / 10);
    gl.flush();
  }
}

window.Goal3DRenderer = Goal3DRenderer;
window.Football3DRenderer = Football3DRenderer;
