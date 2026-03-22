# Two Sum

## 题目
给定一个整数数组 nums 和一个整数目标值 target，请你在该数组中找出和为目标值 target 的那两个整数，并返回它们的数组下标。

## 思路
用哈希表记录已经遍历过的数字。

## Python 代码

```python
def twoSum(nums, target):
    mp = {}
    for i, x in enumerate(nums):
        if target - x in mp:
            return [mp[target - x], i]
        mp[x] = i
```

## 复杂度
- 时间复杂度：O(n)
- 空间复杂度：O(n)
