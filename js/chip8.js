const FREQ_TIME = 1000 / 1000;

const FONTSET = [
  0xf0, 0x90, 0x90, 0x90, 0xf0, //0
  0x20, 0x60, 0x20, 0x20, 0x70, //1
  0xf0, 0x10, 0xf0, 0x80, 0xf0, //2
  0xf0, 0x10, 0xf0, 0x10, 0xf0, //3
  0x90, 0x90, 0xf0, 0x10, 0x10, //4
  0xf0, 0x80, 0xf0, 0x10, 0xf0, //5
  0xf0, 0x80, 0xf0, 0x90, 0xf0, //6
  0xf0, 0x10, 0x20, 0x40, 0x40, //7
  0xf0, 0x90, 0xf0, 0x90, 0xf0, //8
  0xf0, 0x90, 0xf0, 0x10, 0xf0, //9
  0xf0, 0x90, 0xf0, 0x90, 0x90, //A
  0xe0, 0x90, 0xe0, 0x90, 0xe0, //B
  0xf0, 0x80, 0x80, 0x80, 0xf0, //C
  0xe0, 0x90, 0x90, 0x90, 0xe0, //D
  0xf0, 0x80, 0xf0, 0x80, 0xf0, //E
  0xf0, 0x80, 0xf0, 0x80, 0x80, //F
];

var Chip8 = function (container) {

  let canvas = document.createElement("canvas");
  container.appendChild(canvas);

  canvas.width  = 640;
  canvas.height = 320;

  let memory;
  let V;
  let I;
  let pc;

  let stack;
  let stackPointer;

  let delayTimer;
  let soundTimer;

  let keys;
  let display;

  let context =  canvas.getContext("2d");
  let refresh;

  let id; // interval id

  function init() {
    memory = new Array(4096);
    for (let i = 0; i < FONTSET.length; i++) {
      memory[0x50 + i] = FONTSET[i] & 0xff;
    }

    V = new Uint8Array(16);

    I = 0x0;
    pc = 0x200;

    stack = new Array(16);
    stackPointer = 0;

    delayTimer = 0;
    soundTimer = 0;

    keys = new Array(16).fill(0);
    display = new Array(2048); // 64 * 32

    refresh = false;
  }

  function step() {
      _step();
      render();
  }

  function render() {
    if (refresh) {
      refresh = false;
      
      context.clearRect(0, 0, canvas.width, canvas.height);

      let pWidth  = canvas.width / 64;
      let pHeight = canvas.height / 32;

      for (let y, x = 0; x < 64; x++) {
        let bx = x * pWidth;
        for (y = 0; y < 32; y++) {
          let by = y * pHeight;
          if (display[y * 64 + x] == 1) {
            context.fillStyle = "#306230";
          } else {
            context.fillStyle = "#8bac0f";
          }
          context.fillRect(bx, by, pWidth, pHeight);
        }
      }
    }
  }

  function _step() {
    let opcode = (memory[pc] << 8) | memory[pc + 1]; // 0x[pc    ][pc + 1]

    let x = (opcode & 0xf00) >> 8;
    let y = (opcode & 0x0f0) >> 4;
    pc += 2;

    switch (opcode & 0xf000) {
      case 0x0000: {
        // 0nnn - SYS addr
        switch (opcode & 0xff) {
          case 0xe0: {
            // 00E0 - CLS
            // Clear the display.
            for (let i = 0; i < 2048; ++i) {
              display[i] = 0x0;
            }
            refresh = true;
            break;
          }
          case 0x00ee: {
            // 00EE - RET
            // Return from a subroutine.The interpreter sets the program counter to the address at the top of the stack,
            // then subtracts 1 from the stack pointer.
            pc = stack[stackPointer];
            stackPointer--;
            break;
          }
        }
        break;
      }
      case 0x1000: {
        // JP addr
        // Jump to location nnn.
        // The interpreter sets the program counter to nnn.
        pc = opcode & 0xfff;
        break;
      }
      case 0x2000: {
        // CALL addr
        // Call subroutine at nnn.
        // The interpreter increments the stack pointer, then puts the current PC on the top of the stack. The PC is then set to nnn.
        stackPointer++;
        stack[stackPointer] = pc;
        pc = opcode & 0xfff;
        break;
      }
      case 0x3000: {
        // 3xkk - SE Vx, byte
        // Skip next instruction if Vx = kk.
        // The interpreter compares register Vx to kk, and if they are equal, increments the program counter by 2.
        if (V[x] === (opcode & 0xff)) {
          pc += 2;
        }
        break;
      }
      case 0x4000: {
        // 4xkk - SNE Vx, byte
        // Skip next instruction if Vx != kk.
        // The interpreter compares register Vx to kk, and if they are not equal,
        // increments the program counter by 2.
        if (V[x] !== (opcode & 0xff)) {
          pc += 2;
        }
        break;
      }
      case 0x5000: {
        // 5xy0 - SE Vx, Vy
        // Skip next instruction if Vx = Vy.
        // The interpreter compares register Vx to register Vy, and if they are equal, increments the program counter by 2.
        if (V[x] === V[y]) {
          pc += 2;
        }
        break;
      }
      case 0x6000: {
        // 6xkk - LD Vx, byte
        // Set Vx = kk. The interpreter puts the value kk into register Vx
        V[x] = opcode & 0xff;
        break;
      }
      case 0x7000: {
        // 7xkk - ADD Vx, byte
        // Set Vx = Vx + kk. Adds the value kk to the value of register Vx, then stores the result in Vx.
        V[x] += opcode & 0xff;
        if(V[x] > 255) {
          V[x] -= 256;
        } 
        break;
      }
      case 0x8000: {
        switch (opcode & 0xf) {
          case 0x0: {
            // 8xy0 - LD Vx, Vy
            // Set Vx = Vy. Stores the value of register Vy in register Vx.
            V[x] = V[y];
            break;
          }
          case 0x1: {
            // 8xy1 - OR Vx, Vy
            // Set Vx = Vx OR Vy. Performs a bitwise OR on the values of Vx and Vy, then stores the result in Vx. A
            // bitwise OR compares the corresponding bits from two values, and if either bit is 1, then the same bit in the
            // result is also 1. Otherwise, it is 0.
            V[x] |= V[y];
            break;
          }
          case 0x2: {
            // 8xy2 - AND Vx, Vy
            // Set Vx = Vx AND Vy. Performs a bitwise AND on the values of Vx and Vy, then stores the result in Vx.
            // A bitwise AND compares the corresponding bits from two values, and if both bits are 1, then the same bit
            // in the result is also 1. Otherwise, it is 0.
            V[x] &= V[y];
            break;
          }
          case 0x3: {
            // 8xy3 - XOR Vx, Vy
            // Set Vx = Vx XOR Vy. Performs a bitwise exclusive OR on the values of Vx and Vy, then stores the result
            // in Vx. An exclusive OR compares the corresponding bits from two values, and if the bits are not both the
            // same, then the corresponding bit in the result is set to 1. Otherwise, it is 0.
            V[x] ^= V[y];
            break;
          }
          case 0x4: {
            // 8xy4 - ADD Vx, Vy
            // Set Vx = Vx + Vy, set VF = carry. The values of Vx and Vy are added together. If the result is greater
            // than 8 bits (i.e., > 255,) VF is set to 1, otherwise 0. Only the lowest 8 bits of the result are kept, and stored
            // in Vx.
            let tmp = V[x] + V[y];
            V[0xf] = tmp > 0xff ? 1 : 0;
            V[x] = tmp & 0xff;
            break;
          }
          case 0x5: {
            // 8xy5 - SUB Vx, Vy
            // Set Vx = Vx - Vy, set VF = NOT borrow. If Vx > Vy, then VF is set to 1, otherwise 0. Then Vy is
            // subtracted from Vx, and the results stored in Vx.
            V[0xf] = V[x] > V[y] ? 1 : 0;
            V[x] -= V[y];
            break;
          }
          case 0x6: {
            // 8xy6 - SHR Vx {, Vy}
            // Set Vx = Vx SHR 1. If the least-significant bit of Vx is 1, then VF is set to 1, otherwise 0. Then Vx is
            // divided by 2.
            V[0xf] = V[x] & 0x1;
            V[x] >>= 1;
            break;
          }
          case 0x7: {
            // 8xy7 - SUBN Vx, Vy
            // Set Vx = Vy - Vx, set VF = NOT borrow. If Vy > Vx, then VF is set to 1, otherwise 0. Then Vx is
            // subtracted from Vy, and the results stored in Vx.
            V[0xf] = V[y] > V[x] ? 1 : 0;
            V[x] = V[y] - V[x];
            break;
          }
          case 0xe: {
            // 8xyE - SHL Vx {, Vy}
            // Set Vx = Vx SHL 1. If the most-significant bit of Vx is 1, then VF is set to 1, otherwise to 0. Then Vx is
            // multiplied by 2.
            V[0xf] = (V[x] >> 7) & 0x1;
            V[x] <<= 1;
            break;
          }
        }
        break;
      }
      case 0x9000: {
        // 9xy0 - SNE Vx, Vy
        // Skip next instruction if Vx != Vy. The values of Vx and Vy are compared, and if they are not equal, the
        // program counter is increased by 2.
        if (V[x] !== V[y]) {
          pc += 2;
        }
        break;
      }
      case 0xa000: {
        // Annn - LD I, addr
        // Set I = nnn. The value of register I is set to nnn.
        I = opcode & 0xfff;
        break;
      }
      case 0xb000: {
        // Bnnn - JP V0, addr
        // Jump to location nnn + V0. The program counter is set to nnn plus the value of V0.
        pc = (opcode & 0xfff) + V[0];
        break;
      }
      case 0xc000: {
        // Cxkk - RND Vx, byte
        // Set Vx = random byte AND kk. The interpreter generates a random number from 0 to 255, which is then
        // ANDed with the value kk. The results are stored in Vx. See instruction 8xy2 for more information on AND.
        V[x] = Math.floor(Math.random() * 0xff) & (opcode & 0xff);
        break;
      }
      case 0xd000: {
        // Dxyn - DRW Vx, Vy, nibble
        // Display n-byte sprite starting at memory location I at (Vx, Vy), set VF = collision. The interpreter reads n
        // bytes from memory, starting at the address stored in I. These bytes are then displayed as sprites on screen
        // at coordinates (Vx, Vy). Sprites are XOR’d onto the existing screen. If this causes any pixels to be erased,
        // VF is set to 1, otherwise it is set to 0. If the sprite is positioned so part of it is outside the coordinates of
        // the display, it wraps around to the opposite side of the screen.
        V[0xf] = 0;
        let row, tmp, h = opcode & 0xf;
        for (let j, i = 0; i < h; i++) {
          tmp = (V[y] + i) % 32;
          row = memory[I + i];
          for (j = 0; j < 8; j++) {
            if (row & (0x80 >> j)) {
              let index = tmp * 64 + ((V[x] + j) % 64);
              if (display[index] == 1) V[0xf] = 1;
              display[index] ^= 1;
              refresh = true;
            }
          }
        }
        break;
      }
      case 0xe000: {
        switch (opcode & 0xff) {
          case 0x9e: {
            // Ex9E - SKP Vx
            // Skip next instruction if key with the value of Vx is pressed. Checks the keyboard, and if the key corresponding
            // to the value of Vx is currently in the down position, PC is increased by 2.
            if (keys[V[x]] === 1) {
              pc += 2;
            }
            break;
          }
          case 0xa1: {
            // ExA1 - SKNP Vx
            // Skip next instruction if key with the value of Vx is not pressed. Checks the keyboard, and if the key
            // corresponding to the value of Vx is currently in the up position, PC is increased by 2.
            if (keys[V[x]] === 0) {
              pc += 2;
            }
            break;
          }
        }

        break;
      }
      case 0xf000: {
        switch (opcode & 0xff) {
          case 0x7: {
            // Fx07 - LD Vx, DT
            // Set Vx = delay timer value. The value of DT is placed into Vx.
            V[x] = delayTimer;
            break;
          }
          
          case 0xA: {
            // Fx0A - LD Vx, K
            // Wait for a key press, store the value of the key in Vx. All execution stops until a key is pressed, then the
            // value of that key is stored in Vx.
       
            for (let i = 0; i < 16; ++i) {
              if (keys[i] == 1) {
                V[x] = i;
                return;
              }
            }
            pc -= 2;
            break;
          }
          case 0x15: {
            // Fx15 - LD DT, Vx
            // Set delay timer = Vx. Delay Timer is set equal to the value of Vx.
            delayTimer = V[x];
            break;
          }
          case 0x18: {
            // Fx18 - LD ST, Vx
            // Set sound timer = Vx. Sound Timer is set equal to the value of Vx.
            soundTimer = V[x];
            break;
          }
          case 0x1e: {
            // Fx1E - ADD I, Vx
            // Set I = I + Vx. The values of I and Vx are added, and the results are stored in I.
            I += V[x];
            break;
          }
          case 0x29: {
            // Fx29 - LD F, Vx
            // Set I = location of sprite for digit Vx. The value of I is set to the location for the hexadecimal sprite
            // corresponding to the value of Vx. See section 2.4, Display, for more information on the Chip-8 hexadecimal
            // font. To obtain this value, multiply VX by 5 (all font data stored in first 80 bytes of memory).
            I = 0x050 + V[x] * 5;
            break;
          }
          case 0x33: {
            // Fx33 - LD B, Vx
            // Store BCD representation of Vx in memory locations I, I+1, and I+2. The interpreter takes the decimal
            // value of Vx, and places the hundreds digit in memory at location in I, the tens digit at location I+1, and
            // the ones digit at location I+2.
            let hundreds = parseInt(V[x] / 100);
            let tens = parseInt((V[x] % 100) / 10);
            let ones = V[x] % 10;
            memory[I] = hundreds;
            memory[I + 1] = tens;
            memory[I + 2] = ones;
            break;
          }
          case 0x55: {
            // Fx55 - LD [I], Vx
            // Stores V0 to VX in memory starting at address I. I is then set to I + x + 1
            for (let i = 0; i <= x; i++) {
              memory[I + i] = V[i];
            }
            break;
          }
          case 0x65: {
            // Fx65 - LD Vx, [I]
            // Fills V0 to VX with values from memory starting at address I. I is then set to I + x + 1.
            for (let i = 0; i <= x; ++i) {
              V[i] = memory[I + i];
            }
            // I += x + 1;
            break;
          }
        }
        break;
      }
    }

    if (soundTimer > 0) {
      soundTimer--;
    }

    if (delayTimer > 0) {
      delayTimer--;
    }
  }

  this.loadProgram = function (file) {
    let self = this;
    self.stop();

    init();

    let xhr = new XMLHttpRequest();
    xhr.responseType = "arraybuffer";
    xhr.onload = function (e) {
      if (this.status === 200) {
        var bytes = new Uint8Array(this.response);
        for (let i = 0; i < bytes.length; ++i) {
          memory[0x200 + i] = bytes[i];
        }
        self.start();
      }
    };

    xhr.open("GET", file), true;
    xhr.send(null);
  };

  this.start = function () {
    if (!id) {
      id = setInterval(step, FREQ_TIME);
    }
  };

  this.stop = function () {
    if(id) {
      clearInterval(id);
      id = null;
    }
  };

  const keyevent = function(e, value) {

      switch(e.key) {
        case '1': keys[0x1] = value; break;
        case '2': keys[0x2] = value; break;
        case '3': keys[0x3] = value; break;
        case '4': keys[0xC] = value; break;

        case 'q': keys[0x4] = value; break;
        case 'w': keys[0x5] = value; break;
        case 'e': keys[0x6] = value; break;
        case 'r': keys[0xD] = value; break;

        case 'a': keys[0x7] = value; break;
        case 's': keys[0x8] = value; break;
        case 'd': keys[0x9] = value; break;
        case 'f': keys[0xE] = value; break;

        case 'z': keys[0xA] = value; break;
        case 'x': keys[0x0] = value; break;
        case 'c': keys[0xB] = value; break;
        case 'v': keys[0xF] = value; break;
      }
  
  };

  document.addEventListener('keydown', function(e) {
    keyevent(e, 1);
  }, false);

  document.addEventListener('keyup', function(e) {
    keyevent(e, 0);
  }, false);

}
