import { notFound } from 'next/navigation';
import Concept from '../../concept';
export function generateStaticParams(){return ['raum','glanz','tavola'].map(slug=>({slug}));}
export default async function Page({params}){const {slug}=await params;if(!['raum','glanz','tavola'].includes(slug))notFound();return <Concept kind={slug}/>;}
