# CF 2209B Array



## 题目链接：[Problem - B - Codeforces](https://codeforces.com/contest/2209/problem/B)



## 题意

给定长度为 n 的整数数组 a，对每个下标 i，求满足以下条件的下标 j>i 的**最大数量**：存在整数 k，使得 ∣a_i−k∣>∣a_j−k∣。

输出每组测试用例对应的 n 个答案。



## 思路

这道题可以简化为对于每个点找它右边比他大的个数和比他小的个数，输出个数较大的那个。那直接每个点跑双指针，复杂度n方。或使用线段树或树状数组优化为nlogn，但对于B题来说没有必要。



## 代码

```
#include <bits/stdc++.h>
#define int long long
#define endl "\n"
#define mod 1000000007
using namespace std;



int a[6000];

void solve(){
	int n;
	cin>>n;
	for(int i=0;i<n;i++){
		cin>>a[i];
	}
	for(int i=0;i<n;i++){
		int num=0;
		int deng=0;
		for(int j=i+1;j<n;j++){
			if(a[j]>a[i]){
				num++;
			}
			if(a[j]==a[i]){
				deng++;
			}
		}
		cout<<max(num,n-i-num-1-deng)<<' ';
	}
	cout<<endl;
	return;
}

signed main(){
    ios::sync_with_stdio(false);
    cin.tie(nullptr);
    int t = 1;
    cin >> t;
    while(t--){
        solve();
    }
}
```



## 复杂度

O（n2）



## 反思

无
