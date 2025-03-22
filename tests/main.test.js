// tests/main.test.js
import { expect } from '@jest/globals'
import { deepEquals, genBindings, mvar, match, NoMatch, partition, wildcard } from '../src/impl/impl.js'

expect.extend({
    toBeIdentical(actual, expected) {
        return {
            message: () =>
                `expected ${this.utils.printReceived(
                    actual,
                )} to be identical to ${this.utils.printExpected(
                    expected,
                )}`,
            pass: actual === expected,
        }
    },

    toBeIterable(actual) {
        return {
            message: () =>
                `expected ${this.utils.printReceived(
                    actual,
                )} to be iterable, but it lacks \`Symbol.iterator\` and \`.next\` functions`,
            pass: typeof actual[Symbol.iterator] == 'function' && typeof actual.next == 'function'
        }
    },
})

describe('match function', () => {
    it('matches with a single pattern', () => {
        expect(match(
            [{ x: 1, y: { a: '2' }, z: { b: false } }],
            ([val1, val2, val3]) => [
                () => [{ x: val1, y: val2, z: { b: val3 } }],
                () => [val1, val2, val3],
            ]
        )).toEqual([1, { a: '2' }, false])
    })

    it('matches with no mvars involved', () => {
        expect(match(
            false,
            () => [
                () => false,
                () => 'match',
            ]
        )).toEqual('match')

        expect(match(
            ['a', 1],
            () => [
                () => ['a', 1],
                () => 'match',
            ]
        )).toEqual('match')

        expect(match(
            { a: 1 },
            () => [
                () => ({ a: 1 }),
                () => 'match',
            ]
        )).toEqual('match')
    })

    it('fails when there are no matches', () => {
        expect(() => match(
            1,
            () => [
                () => 2,
                () => 'Won\'t ever reach this.',
            ]
        )).toThrow('No valid matches for any patterns and no default case provided.')

        expect(() => match(
            [{ x: 1, y: { a: '2' }, z: { b: false, c: true } }],
            ([val1, val2, val3]) => [
                () => [{ x: val1, y: val2, z: { b: val3, c: false } }],
                () => [val1, val2, val3],
            ]
        )).toThrow('No valid matches for any patterns and no default case provided.')
    })

    it('fails when there are no matches on empty arrays or objects', () => {
        expect(() => match(
            1,
            () => [
                () => [],
                () => 'Won\'t ever reach this.',
            ]
        )).toThrow('No valid matches for any patterns and no default case provided.')

        expect(() => match(
            2,
            () => [
                () => ({}),
                () => 'Won\'t ever reach this.',
            ]
        )).toThrow('No valid matches for any patterns and no default case provided.')

        expect(() => match(
            [],
            () => [
                () => 1,
                () => 'Won\'t ever reach this.',
            ]
        )).toThrow('No valid matches for any patterns and no default case provided.')

        expect(() => match(
            {},
            () => [
                () => 1,
                () => 'Won\'t ever reach this.',
            ]
        )).toThrow('No valid matches for any patterns and no default case provided.')
    })

    it('falls back to default', () => {
        expect(match(
            [1, 2, 3],
            ([val1, val2]) => [
                // No matches
                () => [1, val1, 4],
                () => [val1],

                () => [2, val1, val2],
                () => [val1, val2],

                // default
                () => 'Some default',
            ]
        )).toEqual('Some default')
    })

    it('returns first successful match', () => {
        expect(match(
            [{ x: 1, y: { a: '2' }, z: { b: false, c: true } }],
            ([val1, val2, val3]) => [
                // No match
                () => [{ x: val1, y: val2, z: { b: val3, c: false } }],
                () => [val1, val2, val3],

                // Match
                () => [{ x: val1, y: val3, z: { b: val2, c: true } }],
                () => [val1, val2, val3],

                // Won't reach
                () => [{ x: val3, y: val1, z: { b: val2, c: true } }],
                () => [val1, val2, val3],
            ]
        )).toEqual([1, false, { a: '2' }])
    })

    it('matches on or-patterns without nested mvars', () => {
        expect(match(
            [0, 1, 2, 3, 4, 5],
            ([mvar1]) => [
                () => [0, 1, 2, mvar1.or(4, 3), 4, 5],
                () => mvar1
            ],
        )).toEqual(3)
    })

    it('fails a match on or-patterns without nested mvars', () => {
        expect(() => match(
            [0, 1, 2, 3, 4, 5],
            ([mvar1]) => [
                () => [0, 1, 2, mvar1.or(-4, -3), 4, 5],
                () => mvar1,
            ],
        )).toThrow(NoMatch)
    })

    it('matches on or-patterns with nested mvars', () => {
        expect(match(
            [0, 1, 2, { num: 3, eng: 'three' }, 4, 5],
            ([mvar1, mvar2]) => [
                () => [0, 1, 2, mvar1.or({ num: mvar2, eng: 'four' }, { num: mvar2, eng: 'three' }), 4, 5],
                () => [mvar1, mvar2]
            ],
        )).toEqual([
            { num: 3, eng: 'three' },
            3
        ])

        expect(match(
            { a: { b: { c: { d: 'e' } } } },
            ([mvar1, mvar2, mvar3], { _ }) => [
                () => mvar1.or(
                    {
                        a: {
                            b: mvar2.or(
                                { c: _, d: mvar3.or('f', 'E') },
                                { c: { d: mvar3.or('f', 'E') } },
                            )
                        }
                    },
                    {
                        a: {
                            b: mvar2.or(
                                { c: _, d: mvar3.or('e', 'E') },
                                { c: { d: mvar3.or('e', 'E') } },
                            )
                        }
                    }
                ),
                () => [mvar1, mvar2, mvar3],
            ],
        )).toEqual([
            { a: { b: { c: { d: 'e' } } } },
            { c: { d: 'e' } },
            'e',
        ])
    })

    it('fails a match on or-patterns with nested mvars', () => {
        expect(() => match(
            [0, 1, 2, { num: 3, eng: 'three' }, 4, 5],
            ([mvar1, mvar2]) => [
                () => [0, 1, 2, mvar1.or({ num: mvar2, eng: 'four' }, { num: mvar2.when(x => x > 3), eng: 'three' }), 4, 5],
                () => [mvar1, mvar2]
            ],
        )).toThrow(NoMatch)
    })

    it('performs transformations', () => {
        expect(match(
            [0, 1, 2, 3],
            ([i], { _ }) => [
                () => [0, i.then(i => i + 1), ..._],
                () => i,
            ]
        )).toEqual(2)

        expect(match(
            [0, 1, 2, 3],
            ([i], { _ }) => {
                return [
                    () => [0, i.then(i => i + 1).then(i => i / 3), ..._],
                    () => i,
                ]
            }
        )).toEqual(2 / 3)

        expect(match(
            [0, 1, 2, 3],
            ([i], { _ }) => {
                return [
                    () => [0, i.then(i => i + 1).then(i => i / 3, i => i / 6), ..._],
                    () => i,
                ]
            }
        )).toEqual(2 / 3 / 6)

        expect(match(
            [0, 1, 2, 3],
            ([i], { _ }) => {
                return [
                    () => [0, i.then(i => i + 1).then(i => i / 3, i => i / 6).then(() => false), ..._],
                    () => i,
                ]
            }
        )).toEqual(false)
    })

    it('works with guards', () => {
        const between10and12 = x => x > 10 && x < 12
        expect(match(
            [10, 11, 12, 13, 14, 15],
            ([mvar]) => [
                () => [10, mvar.when(between10and12), 12, 13, 14, 15],
                () => mvar,
            ]
        )).toEqual(11)

        expect(() => match(
            [10, 11, 12, 13, 14, 15],
            ([mvar]) => [
                () => [10, 11, mvar.when(between10and12), 13, 14, 15],
                () => mvar,
            ]
        )).toThrow(NoMatch)

        expect(match(
            [10, 11, 12, 13, 14, 15],
            ([mvar]) => [
                () => [10, 11, ...mvar.when(([x]) => x == 12)],
                () => mvar,
            ]
        )).toEqual([12, 13, 14, 15])

        expect(() => match(
            [10, 11, 12, 13, 14, 15],
            ([mvar]) => [
                () => [10, 11, 12, ...mvar.when(([x]) => x == 12)],
                () => mvar,
            ]
        )).toThrow(NoMatch)

        expect(match(
            { a: 1, b: 2, c: 3, d: 4 },
            ([mvar]) => [
                () => ({ a: 1, ...mvar.when(({ b }) => b == 2) }),
                () => mvar,
            ]
        )).toEqual({ b: 2, c: 3, d: 4 })

        expect(() => match(
            { a: 1, b: 2, c: 3, d: 4 },
            ([mvar]) => [
                () => ({ a: 1, ...mvar.when(({ b }) => b == 3) }),
                () => mvar,
            ]
        )).toThrow(NoMatch)
    })

    it('works with guards (alternative syntax)', () => {
        const between10and12 = x => x > 10 && x < 12
        expect(match(
            [10, 11, 12, 13, 14, 15],
            [
                ([mvar]) => [10, mvar.when(between10and12), 12, 13, 14, 15],
                ([mvar]) => mvar,
            ]
        )).toEqual(11)

        expect(() => match(
            [10, 11, 12, 13, 14, 15],
            [
                ([mvar]) => [10, 11, mvar.when(between10and12), 13, 14, 15],
                ([mvar]) => mvar,
            ]
        )).toThrow(NoMatch)

        expect(match(
            [10, 11, 12, 13, 14, 15],
            [
                ([mvar]) => [10, 11, ...mvar.when(([x]) => x == 12)],
                ([mvar]) => mvar,
            ]
        )).toEqual([12, 13, 14, 15])

        expect(() => match(
            [10, 11, 12, 13, 14, 15],
            [
                ([mvar]) => [10, 11, 12, ...mvar.when(([x]) => x == 12)],
                ([mvar]) => mvar,
            ]
        )).toThrow(NoMatch)

        expect(match(
            { a: 1, b: 2, c: 3, d: 4 },
            [
                ([mvar]) => ({ a: 1, ...mvar.when(({ b }) => b == 2) }),
                ([mvar]) => mvar,
            ]
        )).toEqual({ b: 2, c: 3, d: 4 })

        expect(() => match(
            { a: 1, b: 2, c: 3, d: 4 },
            [
                ([mvar]) => ({ a: 1, ...mvar.when(({ b }) => b == 3) }),
                ([mvar]) => mvar,
            ]
        )).toThrow(NoMatch)
    })

    it('works with wildcards', () => {
        expect(match(
            [0, 1, 2, 3, 4, 5, 6, 7],
            ([i], { _ }) => [
                () => [_, _, _, _, i, _, _, _],
                () => i,
            ]
        )).toEqual(4)

        // Alternative syntax
        expect(match(
            [0, 1, 2, 3, 4, 5, 6, 7],
            [
                ([i], { _ }) => [_, _, _, _, _, i, _, _],
                ([i]) => i,
            ]
        )).toEqual(5)

        expect(match(
            [0, 1, 2, 3, 4, 5],
            ([i], { _ }) => [
                () => [..._, i, _, _],
                () => i,
            ]
        )).toEqual(3)
    })

    it('works with empty wildcards', () => {
        expect(match(
            [0, 1, 2],
            ([i], { _ }) => [
                () => [i, _, _, ..._],
                () => i,
            ]
        )).toEqual(0)

        expect(match(
            [0, 1, 2],
            ([i], { _ }) => [
                () => [..._, i, _, _],
                () => i,
            ]
        )).toEqual(0)

        expect(match(
            [0, 1, 2],
            ([i], { _ }) => [
                () => [...i, _, _, _],
                () => i,
            ]
        )).toEqual([])

        expect(match(
            [0, 1, 2],
            ([i], { _ }) => [
                () => [_, ...i, _, _],
                () => i,
            ]
        )).toEqual([])
    })

    it('works with empty object wildcards', () => {
        expect(
            match(
                { a: 1, b: 2 },
                ([mvar1], { _ }) => [
                    () => ({ a: mvar1, b: 2, ..._ }),
                    () => mvar1
                ]
            )
        ).toEqual(1)

        expect(
            match(
                { a: 1, b: 2 },
                ([mvar1], { _ }) => [
                    () => ({ a: _, b: 2, ...mvar1 }),
                    () => mvar1
                ]
            )
        ).toEqual({})
    })
})

describe('partition function', () => {
    it('returns an iterable (but not an array)', () => {
        expect(partition(1, [10, 11, 12])).toBeIterable()
        expect(partition(1, [10, 11, 12])).not.toBeInstanceOf(Array)
    })

    it('gracefully handles negative partition sizes', () => {
        expect([...partition(-1, [10, 11, 12])]).toEqual([])
    })

    it('trivially returns an empty collection', () => {
        expect([...partition(2, [])]).toEqual([])
    })

    it('partitions a collection', () => {
        expect([...partition(1, [10, 11])]).toEqual([[10], [11]])

        expect([...partition(2, [10, 11, 12])]).toEqual([[10, 11], [12]])
        expect([...partition(2, [10, 11, 12, 13])]).toEqual([[10, 11], [12, 13]])

        expect([...partition(3, [10, 11, 12, 13])]).toEqual([[10, 11, 12], [13]])
        expect([...partition(3, [10, 11, 12, 13, 14, 15, 16, 17])]).toEqual([[10, 11, 12], [13, 14, 15], [16, 17]])

        expect([...partition(3, [10])]).toEqual([[10]])
        expect([...partition(3, [10, 11])]).toEqual([[10, 11]])
    })
})

describe('deepEquals function', () => {
    it('equals', () => {
        expect(deepEquals(1, 1)).toBe(true)
        expect(deepEquals(0, 0)).toBe(true)
        expect(deepEquals(false, false)).toBe(true)
        expect(deepEquals(null, null)).toBe(true)
        expect(deepEquals(undefined, undefined)).toBe(true)

        expect(deepEquals({}, {})).toBe(true)
        expect(deepEquals({ a: 1 }, { a: 1 })).toBe(true)
        expect(deepEquals({ a: { b: 1 } }, { a: { b: 1 } })).toBe(true)

        expect(deepEquals({ a: { b: [1] } }, { a: { b: [1] } })).toBe(true)
        expect(deepEquals([], { length: 0 })).toBe(true)
        expect(deepEquals([], [])).toBe(true)
        expect(deepEquals([1], [1])).toBe(true)
        expect(deepEquals([{}], [{}])).toBe(true)
        expect(deepEquals([{ a: 1 }], [{ a: 1 }])).toBe(true)
        expect(deepEquals([{ a: [{ b: false }] }], [{ a: [{ b: false }] }])).toBe(true)
    })

    it('does not equal', () => {
        expect(deepEquals(1, 0)).toBe(false)
        expect(deepEquals(0, 1)).toBe(false)
        expect(deepEquals(true, false)).toBe(false)
        expect(deepEquals(false, null)).toBe(false)
        expect(deepEquals(null, undefined)).toBe(false)

        expect(deepEquals({ x: 1 }, {})).toBe(false)
        expect(deepEquals({ a: 1 }, { b: 1 })).toBe(false)
        expect(deepEquals({ a: 1 }, { a: 2 })).toBe(false)
        expect(deepEquals({ z: { b: 1 } }, { a: { b: 1 } })).toBe(false)

        expect(deepEquals({ a: { b: [1] } }, { a: { b: [1] }, c: undefined })).toBe(false)
        expect(deepEquals({ a: { b: [1] }, c: undefined }, { a: { b: [1] } })).toBe(false)
        expect(deepEquals([1], { length: 1 })).toBe(false)
        expect(deepEquals([1], [1, 2])).toBe(false)
        expect(deepEquals([{ x: false }], [{ x: undefined }])).toBe(false)
        expect(deepEquals([{ a: false }], [{ a: 1 }])).toBe(false)
        expect(deepEquals([{ a: [{ b: true }] }], [{ a: [{ b: false }] }])).toBe(false)
    })

    it('handles circular references', () => {
        const a = { baz: 1 }
        a.foo = {}
        a.foo.bar = a

        const b = { baz: 1 }
        b.foo = {}
        b.foo.bar = b

        expect(deepEquals(a, b)).toBe(true)
        expect(deepEquals(b, a)).toBe(true)

        const c = { baz: 1 }
        c.foo = {}
        c.foo.bar = { baz: 1, foo: { bar: { baz: 1, foo: { bar: { baz: 1, foo: { bar: c } } } } } }

        const d = { baz: 1 }
        d.foo = {}
        d.foo.bar = d

        expect(deepEquals(c, d)).toBe(true)
        expect(deepEquals(d, c)).toBe(true)

        const e = { baz: 1 }
        e.foo = {}
        e.foo.bar = { baz: 1, foo: { bar: { baz: 1, foo: { bar: { baz: 1, foo: { bar: null } } } } } }

        expect(deepEquals(c, e)).toBe(false)
        expect(deepEquals(e, c)).toBe(false)

        expect(deepEquals(d, e)).toBe(false)
        expect(deepEquals(e, d)).toBe(false)

    })
})

describe('genBindings function', () => {
    it('returns an iterable (but not an array)', () => {
        const mvar1 = mvar()

        expect(genBindings(mvar1, 10, [mvar1])).toBeIterable()
        expect(genBindings(mvar1, 10, [mvar1])).not.toBeInstanceOf(Array)
    })

    it('Trivially binds', () => {
        const mvar1 = mvar()

        expect([...genBindings(mvar1, 10, [mvar1])])
            .toEqual([
                [expect.toBeIdentical(mvar1), 10],
            ])
    })

    it('Binds to object values', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()
        const mvar3 = mvar()

        expect(
            [...genBindings(
                { x: mvar1, y: mvar2, z: mvar3 },
                { x: 1, y: 2, z: 3 },
                [mvar1, mvar2, mvar3],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), 1],
            [expect.toBeIdentical(mvar2), 2],
            [expect.toBeIdentical(mvar3), 3],
        ])
    })

    it('Binds to non-Scalars', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()
        const mvar3 = mvar()

        const nonScalar1 = [0, 1]
        const nonScalar2 = { a: '1', b: '2' }

        expect(
            [...genBindings(
                { x: mvar1, y: mvar2, z: mvar3 },
                { x: 1, y: nonScalar1, z: nonScalar2 },
                [mvar1, mvar2, mvar3],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), 1],
            [expect.toBeIdentical(mvar2), expect.toBeIdentical(nonScalar1)],
            [expect.toBeIdentical(mvar3), expect.toBeIdentical(nonScalar2)],
        ])
    })

    it('Binds to nested object values', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()
        const mvar3 = mvar()

        const nonScalar1 = { a: '1', b: '2' }

        expect(
            [...genBindings(
                { x: mvar1, y: { yInner: mvar2, zInner: mvar3 } },
                { x: 1, y: { yInner: 2, zInner: nonScalar1 } },
                [mvar1, mvar2, mvar3],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), 1],
            [expect.toBeIdentical(mvar2), 2],
            [expect.toBeIdentical(mvar3), expect.toBeIdentical(nonScalar1)],
        ])
    })

    it('Binds to array elements', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()
        const mvar3 = mvar()

        expect(
            [...genBindings(
                [mvar1, mvar2, mvar3],
                [0, 1, 2],
                [mvar1, mvar2, mvar3],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), 0],
            [expect.toBeIdentical(mvar2), 1],
            [expect.toBeIdentical(mvar3), 2],
        ])
    })

    it('Binds to nested array elements', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()
        const mvar3 = mvar()
        const mvar4 = mvar()

        const nonScalar1 = [10, 11]

        expect(
            [
                ...genBindings(
                    [[mvar1, [mvar2, mvar3, [mvar4]]]],
                    [[0, [1, 2, [nonScalar1]]]],
                    [mvar1, mvar2, mvar3, mvar4],
                )
            ]
        ).toEqual([
            [expect.toBeIdentical(mvar1), 0],
            [expect.toBeIdentical(mvar2), 1],
            [expect.toBeIdentical(mvar3), 2],
            [expect.toBeIdentical(mvar4), expect.toBeIdentical(nonScalar1)],
        ])
    })

    it('Raises a NoMatch when the pattern doesn\'t match the input.', () => {
        const mvar1 = mvar()

        expect(() =>
            [...genBindings(
                [0, mvar, 2, 3, 3],
                [0, 1, 2, 3, 4],
                [mvar1],
            )]
        ).toThrow('Input does not match provided pattern.')

        expect(() =>
            [...genBindings(
                [0, mvar1, 2, 3, 4],
                [0, 1, 2, 3],
                [mvar1],
            )]
        ).toThrow('Input is missing index')

        expect(() =>
            [...genBindings(
                [0, mvar1, 2, 3],
                [0, 1, 2, 3, 4],
                [mvar1],
            )]
        ).toThrow('Pattern is missing index')

        expect(() =>
            [...genBindings(
                { foo: mvar1, bar: 'baz' },
                { foo: 'a', bar: ['baz'] },
                [mvar1],
            )]
        ).toThrow('Input does not match provided pattern.')

        expect(() =>
            [...genBindings(
                { foo: mvar1, bar: false },
                { foo: 'a', bar: null },
                [mvar1],
            )]
        ).toThrow('Input does not match provided pattern.')

        expect(() =>
            [...genBindings(
                { foo: mvar1, bar: undefined },
                { foo: 'a' },
                [mvar1],
            )]
        ).toThrow('Input is missing key')

        expect(() =>
            [...genBindings(
                { foo: mvar1, bar: 'baz' },
                { foo: 'a' },
                [mvar1],
            )]
        ).toThrow('Input is missing key')

        expect(() =>
            [...genBindings(
                { foo: mvar1 },
                { foo: 'a', bar: 'baz' },
                [mvar1],
            )]
        ).toThrow('Pattern is missing key')
    })

    it('Properly handles a rest mvar in an object', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()
        const _ = wildcard()

        expect(
            [...genBindings(
                { foo: 'a', ...mvar1 },
                { foo: 'a', bar: 'baz', hi: 'bye' },
                [mvar1, mvar2],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), { bar: 'baz', hi: 'bye' }],
        ])

        expect([...genBindings(
            { foo: 'a', ...mvar1.optional },
            { foo: 'a', bar: 'baz', hi: 'bye' },
            [mvar1])])
            .toEqual([
                [expect.toBeIdentical(mvar1), { bar: 'baz', hi: 'bye' }],
            ])

        expect([...genBindings(
            { foo: 'bar', ...mvar1.optional },
            { foo: 'bar' },
            [mvar1])])
            .toEqual([
                [expect.toBeIdentical(mvar1), {}]
            ])

        expect(() =>
            [...genBindings(
                { x: 'a', ...mvar1, ...mvar2, z: 'd' },
                { x: 'a', z: 'd' },
                [mvar1, mvar2],
            )]
        ).toThrow('Only one rest mvar allowed in object.')

        expect(() =>
            [...genBindings(
                { x: 'a', ...mvar1, z: mvar2 },
                { x: 'a', z: 'd' },
                [mvar1, mvar2],
            )]
        ).not.toThrow('Only one rest mvar allowed in object.')

        expect(() => [...genBindings(
            { a: 1, b: mvar1, ..._, ...mvar2 },
            { a: 1, b: 3, c: 2, d: 10, e: 10 },
            [mvar1, mvar2, _],
        )]).toThrow('Only one rest mvar allowed in object.')


    })

    it('Properly handles a rest mvar in an array', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()

        expect(
            [...genBindings(
                [...mvar1, 'b', 'c', 'd'],
                ['a', 'b', 'c', 'd'],
                [mvar1, mvar2],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), ['a']],
        ])

        expect(
            [...genBindings(
                [...mvar1],
                ['a', 'b', 'c', 'd'],
                [mvar1, mvar2],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), ['a', 'b', 'c', 'd']],
        ])

        expect(
            [...genBindings(
                [...mvar1, mvar2, 'd'],
                ['a', 'b', 'c', 'd'],
                [mvar1, mvar2],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), ['a', 'b']],
            [expect.toBeIdentical(mvar2), 'c'],
        ])

        expect(
            [...genBindings(
                [mvar1, ...mvar2, 'c', 'd'],
                ['a', 'b', 'c', 'd'],
                [mvar1, mvar2],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), 'a'],
            [expect.toBeIdentical(mvar2), ['b']],
        ])

        expect(
            [...genBindings(
                ['a', ...mvar1, 'd'],
                ['a', 'b', 'c', 'd'],
                [mvar1],
            )]
        ).toEqual([
            [expect.toBeIdentical(mvar1), ['b', 'c']],
        ])

        expect(() =>
            [...genBindings(
                ['a', ...mvar1, ...mvar2, 'd'],
                ['a', 'b', 'c', 'd'],
                [mvar1, mvar2],
            )]
        ).toThrow('Only one rest mvar allowed in array.')
    })

    it('ignores wildcards', () => {
        const mvar1 = mvar()
        const _ = wildcard()

        expect(
            [...genBindings(
                [0, 1, 2, mvar1, _, 5],
                [0, 1, 2, 3, 4, 5],
                [mvar1, _])]
        )
            .toEqual([
                [expect.toBeIdentical(mvar1), 3]
            ])

        expect(
            [...genBindings(
                { a: _, b: _, c: _, d: [mvar1], e: _ },
                { a: 1, b: 2, c: 3, d: [4], e: { f: 5 } },
                [mvar1, _])]
        )
            .toEqual([
                [expect.toBeIdentical(mvar1), 4]
            ])
    })

    it('does not allow optional patterns outside of arrays', () => {
        const mvar1 = mvar()

        expect(() => [...genBindings(
            { foo: mvar1.optional },
            { foo: 'bar' },
            [mvar1])])
            .toThrow('Optional patterns only allowed in array patterns.')

        expect(() => [...genBindings(
            mvar1.optional,
            'bar',
            [mvar1])])
            .toThrow('Optional patterns only allowed in array patterns.')

        expect(() => [...genBindings(
            [{ foo: mvar1.optional }],
            [{ foo: 'bar' }],
            [mvar1])])
            .toThrow('Optional patterns only allowed in array patterns.')

        expect(() => [...genBindings(
            [mvar1.optional],
            ['bar'],
            [mvar1])])
            .not.toThrow('Optional patterns only allowed in array patterns.')
    })


    it('supports optional patterns in array patterns', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()

        expect([...genBindings(
            [0, 1, mvar1.optional, 2],
            [0, 1, 2],
            [mvar1])])
            .toEqual([])

        expect([...genBindings(
            [0, 1, mvar1.optional, 2],
            [0, 1, 1.5, 2],
            [mvar1])])
            .toEqual([
                [expect.toBeIdentical(mvar1), 1.5]
            ])

        expect([...genBindings(
            [0, 1, mvar1, mvar2.optional],
            [0, 1, 2],
            [mvar1, mvar2])])
            .toEqual([
                [expect.toBeIdentical(mvar1), 2]
            ])

        expect([...genBindings(
            [0, 1, mvar1, mvar2.optional],
            [0, 1, 2, 3],
            [mvar1, mvar2])])
            .toEqual([
                [expect.toBeIdentical(mvar1), 2],
                [expect.toBeIdentical(mvar2), 3],
            ])

        expect([...genBindings(
            [...mvar1.optional],
            ['bar'],
            [mvar1])])
            .toEqual([
                [expect.toBeIdentical(mvar1), ['bar']],
            ])

        expect([...genBindings(
            ['bar', ...mvar1.optional],
            ['bar'],
            [mvar1])])
            .toEqual([
                [expect.toBeIdentical(mvar1), []],
            ])
    })

    it('matches on optional patterns only after subsequent patterns have been tried', () => {
        const mvar1 = mvar()
        const mvar2 = mvar()

        expect([...genBindings(
            [0, 1, mvar1.optional, mvar2],
            [0, 1, 2],
            [mvar1, mvar2])])
            .toEqual([
                [expect.toBeIdentical(mvar2), 2]
            ])

        expect([...genBindings(
            [0, 1, mvar1.optional, mvar2.optional],
            [0, 1, 2],
            [mvar1, mvar2])])
            .toEqual([
                [expect.toBeIdentical(mvar2), 2]
            ])
    })
})

describe('genBindings', () => {
    it('returns a generator', () => {
        const mvar1 = mvar()
        
        expect(genBindings(mvar1, 10, [mvar1])).toBeIterable()
        expect(genBindings(mvar1, 10, [mvar1])).not.toBeInstanceOf(Array)
    })
    
    it('emits one binding for a simple mvar', () => {
        const mvar1 = mvar()
        
        expect([...genBindings(mvar1, 10, [mvar1])]).toEqual([
            [expect.toBeIdentical(mvar1), 10],
        ])
    })
})
