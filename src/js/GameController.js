/* eslint-disable max-len */
import themes from './themes';
import { generateTeam } from './generators';
import Swordsman from './classes/swordsman';
import Bowerman from './classes/bowerman';
import Magician from './classes/magician';
import Daemon from './classes/daemon';
import Vampire from './classes/vampire';
import Undead from './classes/undead';
import PositionedCharacter from './PositionedCharacter';
import GamePlay from './GamePlay';
import GameState from './GameState';
import cursors from './cursors';

export default class GameController {
  constructor(gamePlay, stateService) {
    this.gamePlay = gamePlay;
    this.stateService = stateService;
    this.humanHeroes = [Bowerman, Swordsman, Magician];
    this.aiHeroes = [Daemon, Vampire, Undead];
    this.startPosHum = [0, 1, 8, 9, 16, 17, 24, 25, 32, 33, 40, 41, 48, 49, 56, 57];
    this.startPosAi = [6, 7, 14, 15, 22, 23, 30, 31, 38, 39, 46, 47, 54, 55, 62, 63];
    this.startPosition = [];
    this.humanTeam = [];
    this.aiTeam = [];
    this.charCount = 2;
    this.selectHero = null;
    this.stateHero = {};
    this.moveHero = [];
    this.attackHero = [];
    this.humDamage = null;
    this.aiDamage = null;
    this.gameState = [];
    this.theme = themes.prairie;
    this.points = 0;
  }

  init() {
    this.gamePlay.drawUi(this.theme);
    this.generateHumHeroes(this.humanHeroes, this.charCount);
    this.generateAiHeroes(this.aiHeroes, this.charCount);
    this.startPositionChar(this.humanTeam, this.aiTeam);
    this.gamePlay.redrawPositions(this.startPosition);
    this.getGameState(this.startPosition);
    this.gamePlay.addCellEnterListener(this.onCellEnter.bind(this));
    this.gamePlay.addCellLeaveListener(this.onCellLeave.bind(this));
    this.gamePlay.addCellClickListener(this.onCellClick.bind(this));
    this.gamePlay.addNewGameListener(this.onNewGameClick.bind(this));
    this.gamePlay.addSaveGameListener(this.onSaveGameClick.bind(this));
    this.gamePlay.addLoadGameListener(this.onLoadGameClick.bind(this));
  }

  startPositionChar(humanTeam, aiTeam) {
    const humStart = [];
    const aiStart = [];

    for (let i = 0; i < humanTeam.length; i += 1) {
      let humanPos = this.startPosHum[Math.floor(Math.random() * this.startPosHum.length)];
      while (humStart.includes(humanPos)) {
        humanPos = this.startPosHum[Math.floor(Math.random() * this.startPosHum.length)];
      }
      humStart.push(humanPos);
      this.startPosition.push(new PositionedCharacter(humanTeam[i], humanPos));
    }
    for (let i = 0; i < aiTeam.length; i += 1) {
      let aiPos = this.startPosAi[Math.floor(Math.random() * this.startPosAi.length)];
      while (aiStart.includes(aiPos)) {
        aiPos = this.startPosAi[Math.floor(Math.random() * this.startPosAi.length)];
      }
      aiStart.push(aiPos);
      this.startPosition.push(new PositionedCharacter(aiTeam[i], aiPos));
    }
  }

  generateHumHeroes(humanHeroes, charCount, level) {
    const humanChar = generateTeam(humanHeroes, charCount);
    for (let i = 0; i < humanChar.length; i += 1) {
      for (let j = 1; j < level; j += 1) {
        humanChar[i].levelUp();
      }
      this.humanTeam.push(humanChar[i]);
    }
  }

  generateAiHeroes(aiHeroes, charCount, level) {
    const aiChar = generateTeam(aiHeroes, charCount);
    for (let i = 0; i < aiChar.length; i += 1) {
      for (let j = 1; j < level; j += 1) {
        aiChar[i].levelUp();
      }
      this.aiTeam.push(aiChar[i]);
    }
  }

  playMove(index, characterPosition) {
    if (this.stateHero && this.moveHero.includes(index)) {
      for (let i = 0; i < this.startPosition.length; i += 1) {
        if (characterPosition === this.startPosition[i].position) {
          this.startPosition[i].position = index;
        }
      }
      this.gamePlay.redrawPositions(this.startPosition);
      this.getGameState(this.startPosition);
      this.playTurn(index, this.startPosition);
    }
  }

  async playAttack(index, character, cell) {
    const cellDom = cell;
    if (['daemon', 'vampire', 'undead'].includes(cell.children[0].classList[1])) {
      for (let i = 0; i < this.startPosition.length; i += 1) {
        if (index === this.startPosition[i].position) {
          const target = this.startPosition[i].character;
          const diff = character.attack - target.defence;
          let odd = 0;
          if (diff <= 0 && diff > (-15)) {
            odd = 0.6;
          } else if (diff <= (-15) && diff > (-30)) {
            odd = 0.4;
          } else if (diff <= (-30)) {
            odd = 0.2;
          }
          this.humDamage = +(Math.max(diff, character.attack * odd)).toFixed();
          target.health -= this.humDamage;
          cellDom.querySelector('.health-level-indicator').style.width = `${target.health}%`;
          if (target.health <= 0) {
            this.characterDeath(target.type, this.startPosition, index);
          }
        }
      }
    }
    await this.gamePlay.showDamage(index, this.humDamage);
    this.playTurn(index, this.startPosition);
  }

  getGameState(startPosition) {
    this.gameState = [];
    this.aiTeam = [];
    this.humanTeam = [];
    for (const iter of startPosition) {
      if (['daemon', 'vampire', 'undead'].includes(iter.character.type)) {
        this.gameState.push(GameState.from({
          character: iter.character,
          position: iter.position,
        }));
        iter.character.position = iter.position;
        this.aiTeam.push(iter.character);
      } else if (['magician', 'swordsman', 'bowman'].includes(iter.character.type)) {
        this.gameState.push(GameState.from({
          character: iter.character,
          position: iter.position,
        }));
        iter.character.position = iter.position;
        this.humanTeam.push(iter.character);
      }
    }
  }

  playTurn(index, startPosition) {
    this.getGameState(startPosition);
    const randAi = Math.floor(Math.random() * this.aiTeam.length);
    this.aiTurnLogic(this.aiTeam[randAi], this.aiTeam[randAi].position);
  }

  aiTurnLogic(char, charPos) {
    const radiusAttack = GameController.cellsAttack(char, charPos);
    let index = null;
    for (let i = 0; i < radiusAttack.length; i += 1) {
      if (this.gamePlay.cells[radiusAttack[i]].children[0] && ['magician', 'swordsman', 'bowman'].includes(this.gamePlay.cells[radiusAttack[i]].children[0].classList[1])) {
        index = radiusAttack[i];
      }
    }
    if (index !== null) {
      this.playAiAttack(index, this.startPosition, char);
    } else {
      this.playAiMove(char, charPos);
    }
  }

  playAiMove(char, charPos) {
    const radiusMove = GameController.cellsMove(char, charPos);
    let randomMove = Math.floor(Math.random() * radiusMove.length);
    while (this.gamePlay.cells[radiusMove[randomMove]].children[0]) {
      randomMove = Math.floor(Math.random() * radiusMove.length);
    }
    for (let i = 0; i < this.startPosition.length; i += 1) {
      if (this.startPosition[i].position === charPos) {
        this.startPosition[i].position = radiusMove[randomMove];
      }
    }

    this.gamePlay.setCursor(cursors.auto);
    this.gamePlay.redrawPositions(this.startPosition);
    this.getGameState(this.startPosition);
  }

  async playAiAttack(index, statePosition, character) {
    let targetPosition = null;

    for (let j = 0; j < statePosition.length; j += 1) {
      if (index === statePosition[j].position) {
        const target = statePosition[j].character;
        targetPosition = index;
        const diff = character.attack - target.defence;
        let odd = 0;
        if (diff <= 0 && diff > (-15)) {
          odd = 0.6;
        } else if (diff <= (-15) && diff > (-30)) {
          odd = 0.4;
        } else if (diff <= (-30)) {
          odd = 0.2;
        }
        this.aiDamage = +(Math.max(diff, character.attack * odd)).toFixed();
        target.health -= this.aiDamage;
        this.gamePlay.cells[index].querySelector('.health-level-indicator').style.width = `${target.health}%`;
        if (target.health <= 0) {
          this.characterDeath(target.type, this.startPosition, index);
        }
      }
    }
    await this.gamePlay.showDamage(targetPosition, this.aiDamage);
  }

  characterDeath(character, statePosition, index) {
    for (let i = 0; i < statePosition.length; i += 1) {
      if (character === statePosition[i].character.type && statePosition[i].position === index) {
        statePosition.splice(i, 1);
      }
    }
    this.gamePlay.deselectCell(this.selectHero);
    this.selectHero = null;
    this.stateHero = {};
    this.gamePlay.setCursor(cursors.auto);
    this.gamePlay.redrawPositions(statePosition);
    this.getGameState(this.startPosition);
    if (this.aiTeam.length === 0) {
      this.humanTeam.forEach((elem) => {
        this.points += elem.health;
        elem.levelUp();
      });
      throw this.nextLevel();
    } else if (this.humanTeam.length === 0) {
      throw GamePlay.showMessage('Game Over');
    }
  }

  nextLevel() {
    this.startPosition = [];
    if (document.querySelector('.prairie') !== null) {
      this.theme = themes.desert;
      this.generateHumHeroes(this.humanHeroes, 1);
    } else if (document.querySelector('.desert') !== null) {
      this.theme = themes.arctic;
      for (let i = 0; i < 2; i += 1) {
        this.generateHumHeroes(this.humanHeroes, 1, Math.max(1, Math.round(Math.random() * 2)));
      }
    } else if (document.querySelector('.arctic') !== null) {
      this.theme = themes.mountain;
      for (let i = 0; i < 2; i += 1) {
        this.generateHumHeroes(this.humanHeroes, 1, Math.max(1, Math.round(Math.random() * 3)));
      }
    } else if (document.querySelector('.mountain') !== null) {
      GamePlay.showMessage('Win!');
      // eslint-disable-next-line no-restricted-globals
      if (confirm('Continue playing?')) {
        this.nextLoop();
      } else {
        GamePlay.showMessage(`You Win! Your points: ${this.points}`);
        this.onNewGameClick();
      }
    }
    this.gamePlay.drawUi(this.theme);
    for (let i = 0; i < this.humanTeam.length; i += 1) {
      this.generateAiHeroes(this.aiHeroes, 1, this.humanTeam[i].level);
    }
    this.startPositionChar(this.humanTeam, this.aiTeam);
    this.gamePlay.redrawPositions(this.startPosition);
    this.getGameState(this.startPosition);
  }

  nextLoop() {
    if (this.humanTeam.length < 23) {
      this.startPosHum = [0, 1, 2, 8, 9, 10, 16, 17, 18, 24, 25, 26, 32, 33, 34, 40, 41, 42, 48, 49, 50, 56, 57, 58];
      this.startPosAi = [5, 6, 7, 13, 14, 15, 21, 22, 23, 29, 30, 31, 37, 38, 39, 45, 46, 47, 53, 54, 55, 61, 62, 63];
      this.theme = themes.prairie;
      for (let i = 0; i < 2; i += 1) {
        this.generateHumHeroes(this.humanHeroes, 1, Math.max(1, Math.round(Math.random() * 4)));
      }
    } else if (this.humanTeam.length >= 23 && this.humanTeam.length < 31) {
      this.startPosHum = [0, 1, 2, 3, 8, 9, 10, 11, 16, 17, 18, 19, 24, 25, 26, 27, 32, 33, 34, 35, 40, 41, 42, 43, 48, 49, 50, 51, 56, 57, 58, 59];
      this.startPosAi = [4, 5, 6, 7, 12, 13, 14, 15, 20, 21, 22, 23, 28, 29, 30, 31, 36, 37, 38, 39, 44, 45, 46, 47, 52, 53, 54, 55, 60, 61, 62, 63];
      this.theme = themes.prairie;
      for (let i = 0; i < 2; i += 1) {
        this.generateHumHeroes(this.humanHeroes, 1, Math.max(1, Math.round(Math.random() * 5)));
      }
    } else {
      this.onNewGameClick();
      throw GamePlay.showMessage(`Congratulation! You Wined Twice! Your points: ${this.points}`);
    }
  }

  onCellClick(index) {
    const cellClick = this.gamePlay.cells[index];
    if (this.humanTeam.includes(this.stateHero) && !cellClick.children[0]) {
      this.playMove(index, this.selectHero);
    } else if (this.humanTeam.includes(this.stateHero) && ['daemon', 'vampire', 'undead'].includes(cellClick.children[0].classList[1]) && this.attackHero.includes(index)) {
      this.playAttack(index, this.stateHero, cellClick);
    }
    for (let i = 0; i < this.humanTeam.length; i += 1) {
      if (this.humanTeam[i].position === index) {
        if (this.selectHero !== null) this.gamePlay.deselectCell(this.selectHero);
        this.selectHero = index;
        this.gamePlay.selectCell(index);
        this.stateHero = this.humanTeam[i];
        this.moveHero = GameController.cellsMove(this.humanTeam[i], index);
        this.attackHero = GameController.cellsAttack(this.humanTeam[i], index);
      }
    }
    if (['daemon', 'vampire', 'undead'].includes(cellClick?.children[0]?.classList[1]) && !this.attackHero.includes(index)) {
      GamePlay.showError('This hero cannot be selected!');
    }
  }

  onCellEnter(index) {
    const cellEnter = this.gamePlay.cells[index];
    if (this.moveHero.includes(index) && this.selectHero !== null) {
      this.gamePlay.selectCell(index, 'green');
    }
    if (cellEnter.title && !cellEnter.children[0]) {
      this.gamePlay.hideCellTooltip(index);
    }
    const medal = '\u{1F396}';
    const swords = '\u{2694}';
    const shield = '\u{1F6E1}';
    const heart = '\u{2764}';
    let message = '';
    if (cellEnter.children[0]) {
      for (let i = 0; i < this.humanTeam.length; i += 1) {
        if (this.humanTeam[i].position === index) {
          this.gamePlay.setCursor(cursors.pointer);
          const health = cellEnter.querySelector('.health-level-indicator').style.width;
          message = `${medal} ${this.humanTeam[i].level} ${swords} ${this.humanTeam[i].attack} ${shield} ${this.humanTeam[i].defence} ${heart} ${health}`;
        }
      }
      for (let i = 0; i < this.aiTeam.length; i += 1) {
        if (this.aiTeam[i].position === index) {
          const health = cellEnter.querySelector('.health-level-indicator').style.width;
          message = `${medal} ${this.aiTeam[i].level} ${swords} ${this.aiTeam[i].attack} ${shield} ${this.aiTeam[i].defence} ${heart} ${health}`;
          if (this.humanTeam.includes(this.stateHero) && this.attackHero.includes(index)) {
            this.gamePlay.setCursor(cursors.crosshair);
            this.gamePlay.selectCell(index, 'red');
          } else {
            this.gamePlay.setCursor(cursors.notallowed);
          }
        }
      }
    }
    if (cellEnter.children[0]) {
      this.gamePlay.showCellTooltip(message, index);
    }
  }

  onCellLeave(index) {
    const cellLeave = this.gamePlay.cells[index];
    if (index !== this.selectHero) {
      this.gamePlay.deselectCell(index);
    }
    if (cellLeave.children[0]) {
      this.gamePlay.setCursor(cursors.auto);
      for (let i = 0; i < this.aiTeam.length; i += 1) {
        if (this.aiTeam[i].type === cellLeave.children[0].classList[1]) {
          this.gamePlay.deselectCell(index, 'red');
        }
      }
    }
  }

  onNewGameClick() {
    this.startPosHum = [0, 1, 8, 9, 16, 17, 24, 25, 32, 33, 40, 41, 48, 49, 56, 57];
    this.startPosAi = [6, 7, 14, 15, 22, 23, 30, 31, 38, 39, 46, 47, 54, 55, 62, 63];
    this.startPosition = [];
    this.humanTeam = [];
    this.aiTeam = [];
    this.theme = themes.prairie;
    this.init();
  }

  onSaveGameClick() {
    localStorage.clear();
    this.stateService.save(GameState.from({
      startPosition: this.startPosition,
      points: this.points,
      theme: this.theme,
    }));
    GamePlay.showMessage('Game saved');
  }

  onLoadGameClick() {
    try {
      const loadGame = this.stateService.load();
      loadGame.startPosition.forEach((elem) => {
        const obj = elem;
        if (obj.character.type === 'swordsman') {
          Object.setPrototypeOf(obj.character, new Swordsman());
        } else if (obj.character.type === 'bowman') {
          Object.setPrototypeOf(obj.character, new Bowerman());
        } else if (obj.character.type === 'magician') {
          Object.setPrototypeOf(obj.character, new Magician());
        }
      });
      this.startPosition = loadGame.startPosition;
      this.gamePlay.drawUi(loadGame.theme);
      this.gamePlay.redrawPositions(loadGame.startPosition);
      this.theme = loadGame.theme;
      this.getGameState(this.startPosition);
    } catch (e) {
      GamePlay.showError(e);
    }
  }

  static cellsMove(character, index) {
    const char = character.moveCell;
    const arr = [];
    const arrHor = [];
    const arrSize = 8;
    let numArr = 0;
    for (let i = 0; i < 64; i += 1) {
      arr.push(i);
    }
    for (let i = 0; i < arr.length; i += arrSize) {
      arrHor.push(arr.slice(i, i + arrSize));
    }
    for (let i = 0; i < arrHor.length; i += 1) {
      if (arrHor[i].includes(index)) numArr = i;
    }
    const horizont = 1;
    const vertical = 8;
    const move = [];
    let moveHorR = index;
    for (let i = 1; i < char; i += 1) {
      moveHorR += horizont;
      if (arrHor[numArr].includes(moveHorR)) move.push(moveHorR);
    }
    let moveHorL = index;
    for (let i = 1; i < char; i += 1) {
      moveHorL -= horizont;
      if (arrHor[numArr].includes(moveHorL)) move.push(moveHorL);
    }

    let moveVertU = index;
    for (let i = 1; i < char; i += 1) {
      moveVertU += vertical;
      if (arr.includes(moveVertU)) move.push(moveVertU);
      let num = 0;
      for (let j = 0; j < arrHor.length; j += 1) {
        if (arrHor[j].includes(moveVertU)) num = j;
      }
      const diagU = moveVertU + horizont * i;
      if (arrHor[num].includes(diagU)) move.push(diagU);
      const diagD = moveVertU - horizont * i;
      if (arrHor[num].includes(diagD)) move.push(diagD);
    }
    let moveVertD = index;
    for (let i = 1; i < char; i += 1) {
      moveVertD -= vertical;
      if (arr.includes(moveVertD)) move.push(moveVertD);
      let num = 0;
      for (let j = 0; j < arrHor.length; j += 1) {
        if (arrHor[j].includes(moveVertD)) num = j;
      }
      const diagU = moveVertD + horizont * i;
      if (arrHor[num].includes(diagU)) move.push(diagU);
      const diagD = moveVertD - horizont * i;
      if (arrHor[num].includes(diagD)) move.push(diagD);
    }
    return move;
  }

  static cellsAttack(character, index) {
    const char = character.attackCell;
    const arr = [];
    const arrHor = [];
    const arrSize = 8;
    let numArr = 0;
    for (let i = 0; i < 64; i += 1) {
      arr.push(i);
    }
    for (let i = 0; i < arr.length; i += arrSize) {
      arrHor.push(arr.slice(i, i + arrSize));
    }
    for (let i = 0; i < arrHor.length; i += 1) {
      if (arrHor[i].includes(index)) numArr = i;
    }

    const horizont = 1;
    const vertical = 8;
    const move = [];
    let moveHorR = index;
    for (let i = 1; i < char; i += 1) {
      moveHorR += horizont;
      if (arrHor[numArr].includes(moveHorR)) {
        move.push(moveHorR);
        for (let j = 1; j < char; j += 1) {
          if (arr.includes(moveHorR + 8 * j)) move.push(moveHorR + 8 * j);
          if (arr.includes(moveHorR - 8 * j)) move.push(moveHorR - 8 * j);
        }
      }
    }
    let moveHorL = index;
    for (let i = 1; i < char; i += 1) {
      moveHorL -= horizont;
      if (arrHor[numArr].includes(moveHorL)) {
        move.push(moveHorL);
        for (let j = 1; j < char; j += 1) {
          if (arr.includes(moveHorL + 8 * j)) move.push(moveHorL + 8 * j);
          if (arr.includes(moveHorL - 8 * j)) move.push(moveHorL - 8 * j);
        }
      }
    }

    let moveVertU = index;
    for (let i = 1; i < char; i += 1) {
      moveVertU += vertical;
      if (arr.includes(moveVertU)) move.push(moveVertU);
    }
    let moveVertD = index;
    for (let i = 1; i < char; i += 1) {
      moveVertD -= vertical;
      if (arr.includes(moveVertD)) move.push(moveVertD);
    }
    return move;
  }
}
