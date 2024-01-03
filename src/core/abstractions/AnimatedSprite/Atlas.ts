import type { Texture } from 'three'
import { TextureLoader } from 'three'
import { useLoader } from '@tresjs/core'
import { reactive } from 'vue'

// NOTE: Internal state, based on Tres Leches https://github.com/Tresjs/leches/blob/428248a3b7cc4d41b0e651dac5f24d67c3fbf470/src/composables/useControls.ts#L11

type Atlas = Record<string, Promise<PageAPI>>
const atlasStore: { [id: string]: Atlas } = reactive({})

function useAtlasProvider(id: string = 'defaultAtlas'): Atlas {
  if (!atlasStore.hasOwnProperty(id)) {
    atlasStore[id] = {}
  }
  return atlasStore[id]
}

export interface AtlasFrame {
  name: string
  src: string
  width: number
  height: number
  top: number
  left: number
}

interface AtlasPage {
  frames: AtlasFrame[]
  namedFrames: Record<string, AtlasFrame[]>
  texture: Texture
}

export function useAnimatedSpriteAtlas(atlasId?: string) {
  const atlas = useAtlasProvider(atlasId)
  const api = {
    getPageAsync: (
      atlasURL: string,
      imageURL: string,
      definitions?: Record<string, string>,
    ) => getPageAsync(atlas, atlasURL, imageURL, definitions),
  }

  return api
}

interface PageAPI {
  getFrames: (
    options: string | number | [number, number]
  ) => ReturnType<typeof getFrames>
  setDefinitions: (
    definitions: Record<string, string>
  ) => ReturnType<typeof setDefinitions>
  getTexture: () => Texture
}

function asyncLoadPage(
  jsonUrl: string,
  textureUrl: string,
  definitions?: Record<string, string>,
): Promise<AtlasPage> {}

async function getPageAsync(
  atlas: Atlas,
  atlasURL: string,
  imageURL: string,
  definitions?: Record<string, string>,
): Promise<PageAPI> {
  const key = computeHash(imageURL)
  if (key in atlas) {
    return atlas[key]
  }

  const jsonPromise = fetch(atlasURL).then(response => response.json())
  const texturePromise = useLoader(TextureLoader, imageURL)
  const pagePromise = Promise.all([jsonPromise, texturePromise]).then(
    (response) => {
      const frames = response[0].frames
      const namedFrames = groupFramesByKey(frames)
      const texture = response[1]
      texture.matrixAutoUpdate = false
      const page: AtlasPage = {
        frames,
        namedFrames,
        texture,
      }
      if (definitions) {
        setDefinitions(page, definitions)
      }
      return page
    },
  )

  atlas[key] = pagePromise.then(page => ({
    getFrames: (options: string | number | [number, number]) =>
      getFrames(page, options),
    setDefinitions: (definitions: Record<string, string>) =>
      setDefinitions(page, definitions),
    getTexture: () => page.texture,
  }))

  return atlas[key]
}

type TokenName = 'COMMA' | 'HYPHEN' | 'OPEN_PAREN' | 'CLOSE_PAREN' | 'NUMBER'
interface Token {
  name: TokenName
  value: number
  startI: number
}
function tokenize(definition: string): Token[] {
  const tokenized: Token[] = []
  let ii = 0
  while (ii < definition.length) {
    const c = definition[ii]
    if ('0123456789'.indexOf(c) > -1) {
      if (
        tokenized.length
        && tokenized[tokenized.length - 1].name === 'NUMBER'
      ) {
        tokenized[tokenized.length - 1].value *= 10
        tokenized[tokenized.length - 1].value += parseInt(c)
      }
      else {
        tokenized.push({ name: 'NUMBER', value: parseInt(c), startI: ii })
      }
    }
    else if (c === ' ') {
    }
    else if (c === ',') {
      tokenized.push({ name: 'COMMA', value: -1, startI: ii })
    }
    else if (c === '(') {
      tokenized.push({ name: 'OPEN_PAREN', value: -1, startI: ii })
    }
    else if (c === ')') {
      tokenized.push({ name: 'CLOSE_PAREN', value: -1, startI: ii })
    }
    else if (c === '-') {
      tokenized.push({ name: 'HYPHEN', value: -1, startI: ii })
    }
    else {
      warnDefinitionBadCharacter('0123456789,-()', c, definition, ii)
    }
    ii++
  }

  return tokenized
}

type Transition = | 'START_FRAME_IN' | 'START_FRAME_OUT' | 'END_FRAME_IN' | 'END_FRAME_OUT' | 'DURATION_IN' | 'DURATION_OUT' | 'NEXT_OR_DONE'
function parse(definition: string) {
  let transition: Transition = 'START_FRAME_IN'
  const parsed = []
  for (const token of tokenize(definition)) {
    if (transition === 'START_FRAME_IN') {
      if (token.name === 'NUMBER') {
        parsed.push({ startFrame: token.value, endFrame: token.value, duration: 1 })
        transition = 'START_FRAME_OUT'
      }
      else {
        warnDefinitionSyntaxError('number', token.name, definition, token.startI)
      }
    }
    else if (transition === 'START_FRAME_OUT') {
      if (token.name === 'COMMA') {
        transition = 'START_FRAME_IN'
      }
      else if (token.name === 'HYPHEN') {
        transition = 'END_FRAME_IN'
      }
      else if (token.name === 'OPEN_PAREN') {
        transition = 'DURATION_IN'
      }
      else {
        warnDefinitionSyntaxError('",", "-", "("', token.name, definition, token.startI)
      }
    }
    else if (transition === 'END_FRAME_IN') {
      if (token.name === 'NUMBER') {
        parsed[parsed.length - 1].endFrame = token.value
        transition = 'END_FRAME_OUT'
      }
      else {
        warnDefinitionSyntaxError('number', token.name, definition, token.startI)
      }
    }
    else if (transition === 'END_FRAME_OUT') {
      if (token.name === 'COMMA') {
        transition = 'START_FRAME_IN'
      }
      else if (token.name === 'OPEN_PAREN') {
        transition = 'DURATION_IN'
      }
      else {
        warnDefinitionSyntaxError('\',\' or \'(\'', token.name, definition, token.startI)
      }
    }
    else if (transition === 'DURATION_IN') {
      if (token.name === 'NUMBER') {
        parsed[parsed.length - 1].duration = token.value
        transition = 'DURATION_OUT'
      }
      else {
        warnDefinitionSyntaxError('number', token.name, definition, token.startI)
      }
    }
    else if (transition === 'DURATION_OUT') {
      if (token.name === 'CLOSE_PAREN') {
        transition = 'NEXT_OR_DONE'
      }
      else {
        warnDefinitionSyntaxError('"("', token.name, definition, token.startI)
      }
    }
    else if (transition === 'NEXT_OR_DONE') {
      if (token.name === 'COMMA') {
        transition = 'START_FRAME_IN'
      }
      else {
        warnDefinitionSyntaxError('","', token.name, definition, token.startI)
      }
    }
  }

  return parsed
}

function setDefinitions(page: AtlasPage, definitions: Record<string, string>) {
  for (const [name, definition] of Object.entries(definitions)) {
    if (!(name in page.namedFrames)) {
      throw new Error(
        `Animation name ${name} not found. ${Object.keys(page.frames)}`,
      )
    }

    const frames: AtlasFrame[] = getFrames(page, name)

    const expanded = []
    for (const info of parse(definition)) {
      if (info.duration <= 0) {
        continue
      }
      else if (info.endFrame === -1 || info.startFrame === info.endFrame) {
        for (let _ = 0; _ < info.duration; _++) {
          expanded.push(info.startFrame)
        }
      }
      else {
        const sign = Math.sign(info.endFrame - info.startFrame)
        for (
          let frame = info.startFrame;
          frame !== info.endFrame;
          frame += sign
        ) {
          for (let _ = 0; _ < info.duration; _++) {
            expanded.push(frame)
          }
        }
      }
    }

    for (const i of expanded) {
      if (i < 0 || frames.length <= i) {
        console.error(
          `Tres/Cientos Atlas: Attempting to access frame index ${i}, but it does not exist.`,
        )
      }
    }
    page.namedFrames[name] = expanded.map(i => frames[i])
  }
}

function warnDefinitionBadCharacter(
  expected: string,
  found: string,
  definition: string,
  index: number,
) {
  console.error(
    `Tres/Cientos Atlas: Unexpected character while processing animation definition: expected ${expected}, got ${found}.
${definition}
${Array(index + 1).join(' ')}^`,
  )
}

function warnDefinitionSyntaxError(
  expected: string,
  found: string,
  definition: string,
  index: number,
) {
  console.error(
    `Tres/Cientos Atlas: Syntax error while processing animation definition: expected ${expected}, got ${found}.
${definition}
${Array(index + 1).join(' ')}^`,
  )
}

function getFrames(
  page: AtlasPage,
  options: string | number | [number, number],
): AtlasFrame[] {
  if (typeof options === 'string') return getFramesByName(page, options)
  else if (typeof options === 'number') return getFramesByIndex(page, options)
  else {
    return getFramesByIndices(page, options[0], options[1])
  }
}

function getFramesByName(page: AtlasPage, name: string): AtlasFrame[] {
  if (!(name in page.namedFrames)) {
    console.error(
      `Tres/Cientos Atlas: getFramesByName – name ${name} does not exist in page.`,
    )
  }
  return page.namedFrames[name]
}

function getFramesByIndex(page: AtlasPage, index: number): AtlasFrame[] {
  if (0 < index || index >= page.frames.length) {
    console.error(
      `Tres/Cientos Atlas: getFramesByIndex – index (${index}) is out of bounds.`,
    )
  }
  return [page.frames[index]]
}

function getFramesByIndices(
  page: AtlasPage,
  startI: number,
  endI: number,
): AtlasFrame[] {
  const sign = Math.sign(endI - startI)
  if (
    startI < 0
    || page.frames.length <= startI
    || endI < 0
    || page.frames.length <= endI
  ) {
    console.error(
      `Tres/Cientos Atlas: getFramesByIndex – [${startI}, ${endI}] is out of bounds.`,
    )
  }
  const result = []
  if (sign === 0) return [page.frames[0]]
  for (let i = startI; i !== endI; i += sign) {
    result.push(page.frames[i])
  }
  return result
}

function computeHash(s: string, start_hash_value = 0): number {
  // Source: https://cp-algorithms.com/string/string-hashing.html
  const p: number = 95 // NOTE: number of printable ASCII keys
  const m: number = 1000000009
  const loCharCode: number = '!'.codePointAt(0) ?? 0
  let hash_value = start_hash_value
  let p_pow = 1;
  [...s].forEach((c: string) => {
    hash_value
      = (hash_value + ((c.codePointAt(0) ?? 0) - loCharCode + 1) * p_pow) % m
    p_pow = (p_pow * p) % m
  })
  return hash_value
}

/**
 * @returns An object where all AtlasFrames with the same key are grouped in an ordered array by name in ascending value.
 * A key is defined as an alphanumeric string preceding a trailing numeric string.
 * E.g.:
 * "hero0Idle" has no key as it does not have trailing numeric string.
 * "heroIdle0" has the key "heroIdle".
 * @example ```
 * groupFramesByKey([{name: hero, ...}, {name: heroJump3, ...}, {name: heroJump0, ...}, {name: heroIdle0, ...}, {name: heroIdle1, ...}]) returns
 * {
 * heroJump: [{name: heroJump0, ...}, {name: heroJump3, ...}],
 * heroIdle: [{name: heroIdle0, ...}, {name: heroIdle1, ...}]
 * }
 * ```
 */
function groupFramesByKey(frames: AtlasFrame[]): Record<string, AtlasFrame[]> {
  const result: Record<string, AtlasFrame[]> = {}

  for (const frame of Object.values(frames)) {
    const key = keyFromName(frame.name)
    const frameNumber = frameNumberFromName(frame.name)
    if (frameNumber === null) {
      continue
    }
    else {
      if (!result.hasOwnProperty(key)) {
        result[key] = []
      }
      const entry = result[key]
      entry.push(frame)
    }

    for (const entry of Object.values(result)) {
      entry.sort((a, b) => a.name.localeCompare(b.name))
    }
  }

  return result
}

const numbersAtEnd = /[0-9]*$/

function keyFromName(maybeName: string) {
  return maybeName.replace(numbersAtEnd, '')
}

function frameNumberFromName(maybeName: string) {
  const matches = maybeName.match(numbersAtEnd)
  if (matches) {
    return parseInt(matches[matches.length - 1])
  }
  return null
}
