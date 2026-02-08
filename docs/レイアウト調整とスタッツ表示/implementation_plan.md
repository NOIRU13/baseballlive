# レイアウト修正計画書

## 現状の問題

スコアボードの幅（1880px）が広すぎて、左右のサイドバー（各320px）に重なり、打順表示が見えなくなっている。

## 目的

スコアボードを左右のサイドバーの間（約1280pxのスペース）に収め、全ての情報が視認できるようにする。

## 変更内容

### `style.css`

スコアボード全体の幅を縮小し、それに合わせて内部要素を全体的にサイズダウンする。

#### 全体レイアウト

- `.top-scoreboard`: `width: 1880px` -> `1260px` (サイドバー間 1280px - マージン 20px)
- `padding`: `0 20px` -> `0 10px`
- `height`: `200px` -> `150px` (全体的な高さも縮小)

#### スコアテーブル (`.line-score-table`)

大幅なシェイプアップを行う。

- `th` font-size: `20px` -> `16px`
- `td` font-size: `36px` -> `24px` (height: `60px` -> `40px`)
- Team Name (`.team-name-cell`): width `180px` -> `120px`, font-size `28px` -> `20px`
- Total Cell (`.total-cell`): font-size `42px` -> `32px`
- マージン調整 (`margin: 0 15px` -> `margin: 0 10px`)

#### イニング表示 (`.inning-box`, `.inning-num`)

- Font Size: `80px` -> `60px`
- Min Width: `120px` -> `90px`
- `.inning-half` font-size: `32px` -> `20px`

#### カウント表示 (`.count-box`, `.count-label`)

- Label Font Size: `28px` -> `20px`
- Dot Size: `20px` -> `14px`
- Gap: `8px` -> `5px`

#### ランナー表示 (`.runner-diamond-mini`)

- Size: `100px` -> `70px`
- Base Size: `24px` -> `16px`
- Base Position:
  - Second: top 5px -> 3px, left 38px -> 27px
  - Third: top 38px -> 27px, left 5px -> 3px
  - First: top 38px -> 27px, right 5px -> 3px

#### Info Section (`.info-section`)

- Font Size: `14px` -> `12px`
- Min Width: `200px` -> `160px`
- Padding: `10px 15px` -> `5px 10px`

## 検証計画

### ブラウザでの目視確認

- `index.html` を開き、スコアボードがサイドバーの間に綺麗に収まっているか確認する。
- 文字が小さくなりすぎて見辛くないか確認する。
- ランナーのダイヤモンドの配置（一塁、二塁、三塁）が崩れていないか確認する。
