/*
 * Copyright © 2015 Thomas Galvin <tom at usn.pw>
 * See the COPYING file for more details.
 */

// Creates a new cell representing a grid cell at position (x, y)
// on the grid, containing the respective DOM (SVG) element.
function Cell(grid, x, y, mass, maxRadius) {
  this.maxRadius = maxRadius;
  this.element = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  this.element.setAttribute("cx", grid.size * (x + 0.5));
  this.element.setAttribute("cy", grid.size * (y + 0.5));
  this.element.setAttribute("r", 0);
  this.element.setAttribute("fill", "white");
  this.element.setAttribute("stroke", "black");
  this.element.setAttribute("stroke-width", 0);
  grid.svg.appendChild(this.element);
  
  this.grid = grid;
  this.x = x;
  this.y = y;
  this.state = [0, 0]; // [0] = displacement, [1] = velocity
  this.deltaState = [  // change in state at the 4 different integration passes for RK4
    [0, 0],
    [0, 0],
    [0, 0],
    [0, 0], 
    [0, 0]
  ];
  this.neighbours = []; // array of neighbouring cells to be populated later on
  this.mass = mass;
  this.removed = false;
}

Cell.prototype.integrate = function(dt, d, grid) {
  if(d < 0 || d >= this.deltaState.length - 1) return;
  // displacement of the cell
  var disp = this.state[0] + this.deltaState[d][0] * dt;
  var vel = this.state[1] + this.deltaState[d][1] * dt;
  
  // Ss: Spring attaching this mass to the grid
  // Sn: Spring attaching this mass to neighbouring masses
  
  var cs = 0.016, // damping coefficient for Ss
      ks = 0.1,   // spring constant for Ss
      kn = 1.0;   // spring constant for Sn
  
  // f = -(kx+bv) (Hooke's law for Ss)
  var f = -(disp * ks + vel * cs);
  
  // calculate force from Sn
  for(var i = 0; i < this.neighbours.length; i++) {
    var ncell = this.neighbours[i];
    f += -(disp - (ncell.state[0] + ncell.deltaState[d][0] * dt)) * kn;
  }
  
  this.deltaState[d + 1] = [this.state[1], f / this.mass]; // acceleration = force / mass
}

// Updates the appeatance of the cell. This sets the radius of
// the cell based on |x| and the color of the cell to green if
// positive and red if negative.
Cell.prototype.update = function() {
  var x = this.state[0]; // the displacement
  if(this.grid.antialias) {
    if(x < 0) {
      this.element.setAttribute("fill", "red");
      this.element.setAttribute("r", (-x * this.maxRadius));
    } else if(x > 0) {
      this.element.setAttribute("fill", "lime");
      this.element.setAttribute("r", (x * this.maxRadius));
    } else {
      // not going to happen under normal circumstances
      this.element.setAttribute("fill", "white");
      this.element.setAttribute("r", 0);
    }
  } else { // with no anti-aliasing, set circle size to an integer... makes the rendering a tad faster
    if(x < 0) {
      this.element.setAttribute("fill", "red");
      this.element.setAttribute("r", (-x * this.maxRadius + 0.6) | 0);
    } else if(x > 0) {
      this.element.setAttribute("fill", "lime");
      this.element.setAttribute("r", (x * this.maxRadius + 0.6) | 0);
    } else {
      // not going to happen under normal circumstances
      this.element.setAttribute("fill", "white");
      this.element.setAttribute("r", 0);
    }
  }
}

// Removes the DOM element of this Cell from the page
Cell.prototype.remove = function() {
  this.grid.svg.removeChild(this.element);
  this.removed = true;
}

// Creates a new grid, representing the 'wave box' using a grid of
// Cells of the given width and height, and grid size, based on the
// given SVG DOM element
function Grid(size, width, height, svg, antialias) {
  this.size = size;
  this.width = width;
  this.height = height;
  this.removed = false;
  this.svg = svg;
  this.antialias = antialias;
  
  this.grid = [];
  for(var i = 0; i < width; i++) {
    var column = [];
    for(var j = 0; j < height; j++) {
      column.push(new Cell(this, i, j, 0.1, size / 2));
    }
    this.grid.push(column);
  }
  for(var i = 0; i < width; i++) {
    for(var j = 0; j < height; j++) {
      if(i > 0) this.grid[i][j].neighbours.push(this.grid[i - 1][j]);
      if(j > 0) this.grid[i][j].neighbours.push(this.grid[i][j - 1]);
      if(i < width - 1) this.grid[i][j].neighbours.push(this.grid[i + 1][j]);
      if(j < height - 1) this.grid[i][j].neighbours.push(this.grid[i][j + 1]);
    }
  }
  
  this.updateInterval = -1;
}

// Redraws all the cells in this grid
Grid.prototype.update = function() {
  if(this.removed) {
    this.setFps(0);
    return;
  }
  for(var x = 0; x < this.width; x++) {
    for(var y = 0; y < this.height; y++) {
      this.grid[x][y].update();
    }
  }
};

Grid.prototype.get = function(x, y) {
  if(this.removed) {
    console.error("Cannot get cell from removed grid: " + this);
  } else {
    return this.grid[x][y];
  }
}

// Stops the draw timer if it's running
Grid.prototype.drawStop = function() {
  if(this.updateInterval !== -1) {
    clearInterval(this.updateInterval);
    this.updateInterval = -1;
  }
}

// Sets the max frames per second for redrawing the grid,
// and starts the draw timer
Grid.prototype.draw = function(fps) {
  this.drawStop();
  if(fps > 0 && !this.removed) {
    var me = this; // argh, JS gotcha
    this.updateInterval = setInterval(function() { me.update.bind(me)(); }, 1000 / fps);
  }
}

// Removes all DOM elements of the Cells in this grid from the page
Grid.prototype.remove = function() {
  for(var x = 0; x < this.width; x++) {
    for(var y = 0; y < this.height; y++) {
      this.grid[x][y].remove();
      delete this.grid[x][y];
    }
    delete this.grid[x];
  }
  delete this.grid;
  this.drawStop();
  this.removed = true;
}