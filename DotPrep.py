#! /usr/bin/env python


# Author: Maria Nattestad
# Email: mnattestad@dnanexus.com
# This code is adapted from Assemblytics unique anchor filtering

import argparse
import gzip
import time
import numpy as np
import operator
import re

def filterAlignments(filename, output_filename, alignments_to_keep, unique_length, header_lines_by_query):
	before = time.time()
	fout = gzip.open(output_filename + ".Assemblytics.unique_length_filtered_l%d.delta.gz" % (unique_length),'w')
	

	f = open(filename)
	header1 = f.readline()
	if header1[0:2]=="\x1f\x8b":
		f.close()
		f = gzip.open(filename)
		header1 = f.readline()
		
	fout.write(header1) # write the first line that we read already
	fout.write(f.readline())
	
	linecounter = 0

	# For filtered delta file:
	list_of_alignments_to_keep = []
	alignment_counter = {}
	keep_printing = False

	# For coords:
	current_query_name = ""
	current_query_position = 0
	fcoords_out_tab = open(output_filename + ".coords.tab",'w')
	fcoords_out_csv = open(output_filename + ".coords.csv",'w')
	fcoords_out_csv.write("ref_start,ref_end,query_start,query_end,ref_length,query_length,ref,query,tag\n")


	# For basic assembly stats:
	ref_sequences = set()
	query_sequences = set()
	ref_lengths = []
	query_lengths = []


	for line in f:
		linecounter += 1
		if line[0]==">":
			fields = line.strip().split()
			
			# For delta file output:
			query = fields[1]
			list_of_alignments_to_keep = alignments_to_keep[query]

			header_needed = False
			for index in list_of_alignments_to_keep:
				if line.strip() == header_lines_by_query[query][index]:
					header_needed = True
			if header_needed == True:
				fout.write(line) # if we have any alignments under this header, print the header
			alignment_counter[query] = alignment_counter.get(query,0)

			# For coords:
			current_reference_name = fields[0][1:]
			current_query_name = fields[1]

			current_reference_size = int(fields[2])
			current_query_size = int(fields[3])

			# For basic assembly stats:
			if not current_reference_name in ref_sequences:
				ref_lengths.append(current_reference_size)
				ref_sequences.add(current_reference_name)
			if not current_query_name in query_sequences:
				query_lengths.append(current_query_size)
				query_sequences.add(current_query_name)

		else:
			fields = line.strip().split()
			if len(fields) > 4:
				# For coords:
				ref_start = int(fields[0])
				ref_end = int(fields[1])
				query_start = int(fields[2])
				query_end = int(fields[3])
				csv_tag = "repetitive"
				if alignment_counter[query] in list_of_alignments_to_keep:
					fout.write(line)
					fcoords_out_tab.write("\t".join(map(str,[ref_start,ref_end,query_start, query_end,current_reference_size,current_query_size,current_reference_name,current_query_name])) + "\n")
					csv_tag = "unique"
					keep_printing = True
				else:
					keep_printing = False
				fcoords_out_csv.write(",".join(map(str,[ref_start,ref_end,query_start, query_end,current_reference_size,current_query_size,current_reference_name.replace(",","_"),current_query_name.replace(",","_"),csv_tag])) + "\n")
				alignment_counter[query] = alignment_counter[query] + 1

			elif keep_printing == True:
				fout.write(line)

	f.close()
	fout.close()
	fcoords_out_tab.close()
	fcoords_out_csv.close()

	print "Reading file and recording all the entries we decided to keep: %d seconds for %d total lines in file" % (time.time()-before,linecounter)
	
	return ref_lengths, query_lengths, header1

def run(args):
	filename = args.delta
	unique_length = args.unique_length
	output_filename = args.out
	keep_small_uniques = True #args.keep_small_uniques
  
  	header_lines_by_query, lines_by_query = getQueryRefCombinations(filename)
	
	alignments_to_keep = decideAlignmentsToKeep(header_lines_by_query, lines_by_query, unique_length, keep_small_uniques)


	ref_lengths, query_lengths, header1 = filterAlignments(filename, output_filename, alignments_to_keep, unique_length, header_lines_by_query)
	
	recordAssemblyStats(output_filename + ".Assemblytics_assembly_stats.txt", ref_lengths, query_lengths, header1)

	index_for_dot(output_filename + ".coords.csv", output_filename)
	


	

def recordAssemblyStats(output_filename, ref_lengths, query_lengths, header1):
	ref_lengths.sort()
	query_lengths.sort()

	# Assembly statistics
	ref_lengths = np.array(ref_lengths)
	query_lengths = np.array(query_lengths)

	f_stats_out = open(output_filename,"w")

	f_stats_out.write("Reference: %s\n" % (header1.split()[0].split("/")[-1]))
	f_stats_out.write( "Number of sequences: %s\n" % intWithCommas(len(ref_lengths)))
	f_stats_out.write( "Total sequence length: %s\n" %  gig_meg(sum(ref_lengths)))
	f_stats_out.write( "Mean: %s\n" % gig_meg(np.mean(ref_lengths)))
	f_stats_out.write( "Min: %s\n" % gig_meg(np.min(ref_lengths)))
	f_stats_out.write( "Max: %s\n" % gig_meg(np.max(ref_lengths)))
	f_stats_out.write( "N50: %s\n" % gig_meg(N50(ref_lengths)))
	f_stats_out.write( "\n\n")
	f_stats_out.write( "Query: %s\n" % header1.split()[1].split("/")[-1])
	f_stats_out.write( "Number of sequences: %s\n" % intWithCommas(len(query_lengths)))
	f_stats_out.write( "Total sequence length: %s\n" % gig_meg(sum(query_lengths)))
	f_stats_out.write( "Mean: %s\n" % gig_meg(np.mean(query_lengths)))
	f_stats_out.write( "Min: %s\n" % gig_meg(np.min(query_lengths)))
	f_stats_out.write( "Max: %s\n" % gig_meg(np.max(query_lengths)))
	f_stats_out.write( "N50: %s\n" % gig_meg(N50(query_lengths)))

	f_stats_out.close()


def getQueryRefCombinations(filename):
	print "header:"
	
	f = open(filename)
	header1 = f.readline()
	if header1[0:2]=="\x1f\x8b":
		f.close()
		f = gzip.open(filename)
		print f.readline().strip()
	else:
		print header1.strip()
	
	# Ignore the first two lines for now
	print f.readline().strip()

	linecounter = 0

	current_query_name = ""
	current_header = ""

	lines_by_query = {}
	header_lines_by_query = {}

	before = time.time()

	existing_query_names = set()

	for line in f:
		if line[0]==">":
			linecounter += 1
			fields = line.strip().split()
			current_query_name = fields[1]
			current_header = line.strip()
			if current_query_name not in existing_query_names:
				lines_by_query[current_query_name] = []
				header_lines_by_query[current_query_name] = []
				existing_query_names.add(current_query_name)
		else:
			fields = line.strip().split()
			if len(fields) > 4:
				# sometimes start and end are the other way around, but for this they need to be in order
				query_min = min([int(fields[2]),int(fields[3])])
				query_max = max([int(fields[2]),int(fields[3])])
				lines_by_query[current_query_name].append((query_min,query_max))
				header_lines_by_query[current_query_name].append(current_header)

	f.close()

	print "First read through the file: %d seconds for %d query-reference combinations" % (time.time()-before,linecounter)
	
	return (header_lines_by_query, lines_by_query)

def decideAlignmentsToKeep(header_lines_by_query, lines_by_query, unique_length, keep_small_uniques):
	before = time.time()
	alignments_to_keep = {}
	num_queries = len(lines_by_query)
	print "Filtering alignments of %d queries" % (num_queries)
	
	num_query_step_to_report = num_queries/100
	if num_queries < 100:
		num_query_step_to_report = num_queries/10
	if num_queries < 10:
		num_query_step_to_report = 1

	query_counter = 0

	for query in lines_by_query:
		alignments_to_keep[query] = summarize_planesweep(lines_by_query[query], unique_length_required = unique_length,keep_small_uniques=keep_small_uniques)
		query_counter += 1
		if (query_counter % num_query_step_to_report) == 0:
			print "Progress: %d%%" % (query_counter*100/num_queries)
	
	print "Progress: 100%"

	print "Deciding which alignments to keep: %d seconds for %d queries" % (time.time()-before,num_queries)

	return alignments_to_keep


def N50(sorted_list):
	# List should be sorted as increasing

	# We flip the list around here so we start with the largest element
	cumsum = 0
	for length in sorted_list[::-1]:
		cumsum += length
		if cumsum >= sum(sorted_list)/2:
			return length


def gig_meg(number,digits = 2):
	gig = 1000000000.
	meg = 1000000.
	kil = 1000.

	if number > gig:
		return str(round(number/gig,digits)) + " Gbp"
	elif number > meg:
		return str(round(number/meg,digits)) + " Mbp"
	elif number > kil:
		return str(round(number/kil,digits)) + " Kbp"
	else:
		return str(number) + " bp"

def intWithCommas(x):
	if type(x) not in [type(0), type(0L)]:
		raise TypeError("Parameter must be an integer.")
	if x < 0:
		return '-' + intWithCommas(-x)
	result = ''
	while x >= 1000:
		x, r = divmod(x, 1000)
		result = ",%03d%s" % (r, result)
	return "%d%s" % (x, result)


def summarize_planesweep(lines,unique_length_required, keep_small_uniques=False):

	alignments_to_keep = []

	# If no alignments:
	if len(lines)==0:
		return []

	# If only one alignment:
	if len(lines) == 1:
		if keep_small_uniques == True or abs(lines[0][1] - lines[0][0]) >= unique_length_required:
			return [0]
		else:
			return []

	starts_and_stops = []
	for query_min,query_max in lines:
		starts_and_stops.append((query_min,"start"))
		starts_and_stops.append((query_max,"stop"))


	sorted_starts_and_stops = sorted(starts_and_stops,key=operator.itemgetter(0))

	current_coverage = 0
	last_position = -1
	sorted_unique_intervals_left = []
	sorted_unique_intervals_right = []
	for pos,change in sorted_starts_and_stops:
		if current_coverage == 1:
			sorted_unique_intervals_left.append(last_position)
			sorted_unique_intervals_right.append(pos)

		if change == "start":
			current_coverage += 1
		else:
			current_coverage -= 1
		last_position = pos


	linecounter = 0
	for query_min,query_max in lines:

		i = binary_search(query_min,sorted_unique_intervals_left,0,len(sorted_unique_intervals_left))

		exact_match = False
		if sorted_unique_intervals_left[i] == query_min and sorted_unique_intervals_right[i] == query_max:
			exact_match = True
		sum_uniq = 0
		while i < len(sorted_unique_intervals_left) and sorted_unique_intervals_left[i] >= query_min and sorted_unique_intervals_right[i] <= query_max:
			sum_uniq += sorted_unique_intervals_right[i] - sorted_unique_intervals_left[i]
			i += 1

		if sum_uniq >= unique_length_required:
			alignments_to_keep.append(linecounter)
		elif keep_small_uniques == True and exact_match == True:
			alignments_to_keep.append(linecounter)

		linecounter += 1

	return alignments_to_keep



def binary_search(query, numbers, left, right):
	#  Returns index of the matching element or the first element to the right
	
	if left >= right:
		return right
	mid = (right+left)/2
	

	if query == numbers[mid]:
		return mid
	elif query < numbers[mid]:
		return binary_search(query,numbers,left,mid)
	else: # if query > numbers[mid]:
		return binary_search(query,numbers,mid+1,right)



def index_for_dot(coords, output_prefix):

	f = open(coords)
	f.readline() # ignore header

	fields_by_query = {}
	existing_query_names = set()
	existing_reference_names = set()
	reference_lengths = []
	query_lengths = {}
	for line in f:
		fields = line.strip().split(",")
		query_name = fields[7]
		query_lengths[query_name] = int(fields[5])
		if not query_name in existing_query_names:
			fields_by_query[query_name] = []
			existing_query_names.add(query_name)
		fields_by_query[query_name].append(fields)

		ref_name = fields[6]
		ref_length = int(fields[4])
		if not ref_name in existing_reference_names:
			existing_reference_names.add(ref_name)
			reference_lengths.append((ref_name,ref_length))

	f.close()


	#  Find the order of the reference chromosomes
	reference_lengths.sort(key=lambda x: natural_key(x[0]))
	
	#  Find the cumulative sums
	cumulative_sum = 0
	ref_chrom_offsets = {}
	queries_by_reference = {}
	for ref,ref_length in reference_lengths:
		ref_chrom_offsets[ref] = cumulative_sum
		cumulative_sum += ref_length
		queries_by_reference[ref] = set()

	#  Calculate relative positions of each alignment in this cumulative length, and take the median of these for each query, then sort the queries by those scores
	flip_by_query = {}
	references_by_query = {} # for index
	relative_ref_position_by_query = [] # for ordering


	for query_name in fields_by_query:
		lines = fields_by_query[query_name]
		sum_forward = 0
		sum_reverse = 0
		amount_of_reference = {}
		ref_position_scores = []
		references_by_query[query_name] = set()
		for ref,ref_length in reference_lengths:
			amount_of_reference[ref] = 0
		for fields in lines:
			tag = fields[8]
			if tag == "unique":
				query_stop = int(fields[3])
				query_start = int(fields[2])
				ref_start = int(fields[0])
				ref_stop = int(fields[1])
				alignment_length = abs(int(fields[3])-int(fields[2]))
				ref = fields[6]
				
				# for index:
				references_by_query[query_name].add(ref)
				queries_by_reference[ref].add(query_name)
				# amount_of_reference[ref] += alignment_length 

				# for ordering:
				ref_position_scores.append(ref_chrom_offsets[ref] + (ref_start+ref_stop)/2)

				# for orientation:
				if query_stop < query_start:
					sum_reverse += alignment_length
				else:
					sum_forward += alignment_length
		# orientation:
		flip_by_query[query_name] = sum_reverse > sum_forward
		# for ref in amount_of_reference:
			# if amount_of_reference[ref] > 0:
				# references_by_query[query_name].add(ref)
				# queries_by_reference[ref].add(query_name)
		# ordering
		if len(ref_position_scores) > 0:
			relative_ref_position_by_query.append((query_name,np.median(ref_position_scores)))
		else:
			relative_ref_position_by_query.append((query_name,0))


	relative_ref_position_by_query.sort(key=lambda x: x[1])

	fout_ref_index = open(output_prefix + ".ref.index",'w')
	fout_ref_index.write("ref,ref_length,matching_queries\n")
	# reference_lengths is sorted by the reference chromosome name
	for ref,ref_length in reference_lengths:
		fout_ref_index.write("%s,%d,%s\n" % (ref,ref_length,"~".join(queries_by_reference[ref])))
	fout_ref_index.close()

	fout_query_index = open(output_prefix + ".query.index",'w')
	fout_query_index.write("query,query_length,matching_refs\n")
	# relative_ref_position_by_query is sorted by rel_pos
	for query,rel_pos in relative_ref_position_by_query:
		fout_query_index.write("%s,%d,%s\n" % (query,query_lengths[query],"~".join(references_by_query[query])))
	fout_query_index.close()

	

	f = open(coords)
	fout = open(output_prefix + ".oriented_coords.csv",'w')
	header = f.readline().strip()
	fout.write(header+",alignment_length\n") # copy the header

	alignment_length_column = len(header.split(","))

	# sorted_by_alignment_length = []
	uniques = []
	repetitives = []

	for line in f:
		fields = line.strip().split(",")
		query_name = fields[7]
		if flip_by_query[query_name] == True:
			fields[2] = int(fields[5]) - int(fields[2])
			fields[3] = int(fields[5]) - int(fields[3])
			alignment_length = abs(int(fields[2])-int(fields[1]))
		fields.append(alignment_length)
		if fields[8] == "unique":
			uniques.append(fields)
		else:
			repetitives.append(fields)
	f.close()

	uniques.sort(key=lambda x: x[alignment_length_column],reverse=True)
	repetitives.sort(key=lambda x: x[alignment_length_column],reverse=True)
	
	fout_info = open(output_prefix + ".info.csv",'w')
	fout_info.write("key,value\n")
	fout_info.write("unique alignments,%d\n" % len(uniques))
	fout_info.write("repetitive alignments,%d\n" % len(repetitives))


	for fields in uniques:
		fout.write(",".join(map(str,fields)) + "\n")

	if len(repetitives) < 100000:
		for fields in repetitives:
			fout.write(",".join(map(str,fields)) + "\n")
		fout_info.write("showing repetitive alignments,True\n")
	else:
		fout_repeats = open(output_prefix + ".oriented_coords.repetitive.csv",'w')
		fout_repeats.write(header+",alignment_length\n") # copy the header
		for fields in repetitives:
			fout_repeats.write(",".join(map(str,fields)) + "\n")
		fout_repeats.close()
		fout_info.write("showing repetitive alignments,False: Too many\n")

	fout.close()
	fout_info.close()

def natural_key(string_):
	"""See http://www.codinghorror.com/blog/archives/001018.html"""
	return [int(s) if s.isdigit() else s for s in re.split(r'(\d+)', string_)]


def main():
	parser=argparse.ArgumentParser(description="Take a delta file, apply Assemblytics unique anchor filtering, and prepare coordinates input files for Dot")
	parser.add_argument("--delta",help="delta file" ,dest="delta", type=str, required=True)
	parser.add_argument("--out",help="output file" ,dest="out", type=str, default="output")
	parser.add_argument("--unique-length",help="The total length of unique sequence an alignment must have on the query side to be retained. Default: 10000" ,dest="unique_length",type=int, default=10000)
	# parser.add_argument("--keep-small-uniques",help="Keep small aligments (below the unique anchor length) if they are completely unique without any part of the alignment mapping multiple places" ,dest="keep_small_uniques",action="store_true")
	parser.set_defaults(func=run)
	args=parser.parse_args()
	args.func(args)

if __name__=="__main__":
	main()
