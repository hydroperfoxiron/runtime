export function assert(value: any, message: string = ""): void
{
    if (!value)
    {
        throw new Error(message);
    }
}

const INITIAL_CAPACITY = 3;

function assertNotFixedVectorError(value: boolean): void
{
    if (!value)
    {
        throw new RangeError("The fixed property is set to true.");
    }
}

export class FlexDoubleVector
{
    private m_array: Float64Array;
    private m_length: number = 0;
    private m_fixed: boolean;

    constructor(argument: number | Float64Array = 0, fixed: boolean = false)
    {
        if (typeof argument == "number")
        {
            argument = Math.max(0, argument >>> 0);
            this.m_array = new Float64Array(Math.max(INITIAL_CAPACITY, argument));
            this.m_length = argument;
        }
        else
        {
            if (argument.length == 0)
            {
                this.m_array = new Float64Array(INITIAL_CAPACITY);
                this.m_length = 0;
            } else {
                this.m_array = argument.slice(0);
                this.m_length = argument.length;
            }
        }
        this.m_fixed = fixed;
    }

    entries(): Iterator<[number, number]>
    {
        return this.m_array.subarray(0, this.m_length).entries();
    }

    keys(): Iterator<number>
    {
        return this.m_array.subarray(0, this.m_length).keys();
    }

    values(): Iterator<number>
    {
        return this.m_array.subarray(0, this.m_length).values();
    }

    get length(): number
    {
        return this.m_length;
    }

    set length(value: number)
    {
        value = Math.max(0, value >>> 0);
        if (value > this.m_array.length)
        {
            const k = this.m_array;
            this.m_array = new Float64Array(k.length + (value - k.length));
            this.m_array.set(k.subarray(0, k.length));
            this.m_length = value;
        }
        else if (value == 0)
        {
            this.m_array = new Float64Array(INITIAL_CAPACITY);
            this.m_length = 0;
        }
        else
        {
            this.m_array = this.m_array.slice(0, value);
            this.m_length = value;
        }
    }

    get fixed(): boolean
    {
        return this.m_fixed;
    }

    set fixed(value: boolean)
    {
        this.m_fixed = value;
    }

    hasIndex(index: number): boolean
    {
        return index < this.m_length;
    }

    get(index: number): number
    {
        return index < this.m_length ? this.m_array[index] : 0;
    }

    /**
     * @throws {Error} If index is out of range.
     */
    set(index: number, value: number): void
    {
        if (index == this.m_length)
        {
            assertNotFixedVectorError(this.m_fixed);
            this.push(value);
        }
        assert(index < this.m_length);
        this.m_array[index] = value;
    }
    
    push(value: number): void
    {
        assertNotFixedVectorError(this.m_fixed);
        const i = this.m_length++;
        if (i >= this.m_array.length)
        {
            const k = this.m_array;
            this.m_array = new Float64Array(k.length * 2);
            this.m_array.set(k.subarray(0, i));
        }
        this.m_array[i] = value;
    }

    pop(): number
    {
        assertNotFixedVectorError(this.m_fixed);
        return this.m_length == 0 ? 0 : this.m_array[--this.m_length];
    }

    unshift(...args: [number]): number
    {
        fix-me;
    }

    removeAt(index: number): number
    {
        fix-me;
    }
    
    splice(startIndex: number, deleteCount: number = 0xFFFFFFFF, ...items: [number]): FlexDoubleVector
    {
        fix-me;
    }

    slice(startIndex: number = 0, endIndex: number = 0x7FFFFFFF): FlexDoubleVector
    {
        fix-me;
    }
    
    sort(sortBehavior: any): FlexDoubleVector
    {
        fix-me;
    }
}