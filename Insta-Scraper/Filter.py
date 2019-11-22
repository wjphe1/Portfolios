import pickle 
import operator
import os
import csv

with open(os.getcwd()+"/FollowingList/" + "INSERT USERNAME HERE" + '_Following_list.pickle', 'rb') as f:
    Following_list = pickle.load(f)

print(len(Following_list))

""" New = []
for i in range(len(Following_list)):
    New = New + Following_list[i]
 """

d = {}

for terms in Following_list:
    # if we have not seen team before, create k/v pairing
    # setting value to 0, if team already in dict this does nothing
    d.setdefault(terms,0)
    # increase the count for the team
    d[terms] += 1

sorted_d = dict( sorted(d.items(), key=operator.itemgetter(-1),reverse=True))

#with open(os.getcwd()+"/SortedCount/" + "INSERT USERNAME HERE" + "_sorted_count.txt", "w+") as f:
    #for terms, count in sorted_d.items():
        #f.write("{} {}\n".format(terms,count))


with open(os.getcwd()+"/SortedCount/" + "18celebration" + "_sorted_count.csv", 'w+') as f:
    for key in sorted_d.keys():
        f.write("%s,%s\n"%(key,sorted_d[key]))