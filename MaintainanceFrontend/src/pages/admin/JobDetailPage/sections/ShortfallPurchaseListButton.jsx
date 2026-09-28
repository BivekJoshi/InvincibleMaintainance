import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { ShoppingCart } from 'lucide-react';
import { useCreateShortfallPurchaseListMutation } from '@/api/jobsApi';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { pushToast, toastError, toastSuccess } from '@/redux/slices/uiSlice';

/**
 * "Create purchase list from shortfall" (Phase L7, `materials:write`) — on the job's Materials and Materials / Labour
 * tabs. The server works out what is short (planned − issued − on hand, in packs where the material has a pack size)
 * and answers a DRAFT purchase list, which opens; 422 `NO_SHORTFALL` is said in words, not as an error.
 */
export function ShortfallPurchaseListButton({ job, size = 'sm', variant = 'outline' }) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { can } = useAuth();
  const [create, { isLoading }] = useCreateShortfallPurchaseListMutation();
  if (!can('materials:write')) return null;

  const onClick = async () => {
    try {
      const list = await create({ id: job.id }).unwrap();
      dispatch(toastSuccess(`${list.number} drafted`, `${list.items?.length ?? list.itemCount ?? 0} item(s) short for ${job.number}. Check it, then mark it ordered.`));
      navigate(`/admin/purchase-lists/${list.id}`);
    } catch (err) {
      if (err?.data?.error?.code === 'NO_SHORTFALL') {
        dispatch(pushToast({ title: 'Nothing is short', description: err.data.error.message ?? 'Every planned material is issued or in stock.' }));
        return;
      }
      dispatch(toastError('Could not create the purchase list', err?.data?.error?.message));
    }
  };

  return (
    <Button type="button" size={size} variant={variant} loading={isLoading} onClick={onClick}>
      <ShoppingCart aria-hidden /> Create purchase list from shortfall
    </Button>
  );
}
