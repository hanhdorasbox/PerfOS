// Public surface of the acoustic guitar arrangement engine.
export * from './types'
export * from './theory'
export * from './fretboard'
export * from './tab'
export * from './arranger'
export * from './export'
export * from './pitch'
export * from './songs'

// A ready-to-use example so the UI (and demos) always have something to show.
export const EXAMPLE_TAB = `e|----------------------|
B|----------------------|
G|------7---9-----------|
D|--7-------------------|
A|----------------------|
E|----------------------|`

// "Ode to Joy" opening — a friendlier, longer melody to demonstrate harmonisation.
export const EXAMPLE_ODE = `e|--0--0--1--3--3--1--0------|
B|---------------------------|
G|---------------------------|
D|---------------------------|
A|---------------------------|
E|---------------------------|`
